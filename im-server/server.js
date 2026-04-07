// 加载环境变量
require('dotenv').config();

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

// 初始化 Express 应用
const app = express();
const PORT = process.env.PORT || 3001;

// 中间件配置
app.use(cors());
app.use(express.json()); // 解析 JSON 请求体
app.use('/uploads/avatars', express.static(path.join(__dirname, 'uploads/avatars')));
app.use('/uploads/chat', express.static(path.join(__dirname, 'uploads/chat')));

// 创建上传目录
const avatarDir = path.join(__dirname, 'uploads/avatars');
const chatDir = path.join(__dirname, 'uploads/chat');
if (!fs.existsSync(avatarDir)) {
  fs.mkdirSync(avatarDir, { recursive: true });
}
if (!fs.existsSync(chatDir)) {
  fs.mkdirSync(chatDir, { recursive: true });
}

// Multer 配置用于文件上传
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 限制50MB
});

// ====================== WebRTC 配置 ======================
// ICE 服务器配置（通过环境变量配置）
const WEBRTC_CONFIG = {
  turnUrls: process.env.TURN_URLS || '', // 如: 'turn:your-server:3478'
  turnSecret: process.env.TURN_SECRET || '', // TURN 长期凭证密钥
  credentialExpiry: parseInt(process.env.TURN_EXPIRY) || 3600 // 凭证有效期（秒）
};

// 生成 TURN 短效凭证（基于 HMAC-SHA1）
function generateTurnCredentials(userId) {
  if (!WEBRTC_CONFIG.turnUrls || !WEBRTC_CONFIG.turnSecret) {
    return null; // 未配置 TURN 服务器
  }

  const timestamp = Math.floor(Date.now() / 1000) + WEBRTC_CONFIG.credentialExpiry;
  const username = `${timestamp}:${userId}`;
  const credential = crypto
    .createHmac('sha1', WEBRTC_CONFIG.turnSecret)
    .update(username)
    .digest('base64');

  return {
    username,
    credential,
    urls: WEBRTC_CONFIG.turnUrls
  };
}

// 计算文件 SHA1
function calculateSHA1(buffer) {
  return crypto.createHash('sha1').update(buffer).digest('hex');
}

// 数据库初始化
const db = new sqlite3.Database('./im.db', (err) => {
  if (err) {
    console.error('数据库连接失败:', err.message);
  } else {
    console.log('成功连接到 SQLite 数据库');
    // 创建用户表
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        avatar TEXT DEFAULT 'default-avatar.png',
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建好友关系表
    db.run(`
      CREATE TABLE IF NOT EXISTS friends (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        friend_id TEXT NOT NULL,
        remark TEXT DEFAULT '',
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (friend_id) REFERENCES users(id),
        UNIQUE(user_id, friend_id)
      )
    `);

    // 创建好友申请表
    db.run(`
      CREATE TABLE IF NOT EXISTS friend_requests (
        id TEXT PRIMARY KEY,
        from_user_id TEXT NOT NULL,
        to_user_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user_id) REFERENCES users(id),
        FOREIGN KEY (to_user_id) REFERENCES users(id),
        UNIQUE(from_user_id, to_user_id)
      )
    `);

    // 创建群组表
    db.run(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        avatar TEXT DEFAULT '',
        owner_id TEXT NOT NULL,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id)
      )
    `);

    // 创建群成员表
    db.run(`
      CREATE TABLE IF NOT EXISTS group_members (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        join_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(group_id, user_id)
      )
    `);

    // 创建群邀请表
    db.run(`
      CREATE TABLE IF NOT EXISTS group_invites (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        inviter_id TEXT NOT NULL,
        invitee_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (inviter_id) REFERENCES users(id),
        FOREIGN KEY (invitee_id) REFERENCES users(id)
      )
    `);

    // 创建消息表（支持文本、图片、文件类型）
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sender_id TEXT NOT NULL,
        receiver_id TEXT NOT NULL,
        content TEXT NOT NULL,
        message_type TEXT DEFAULT 'text',
        file_id TEXT,
        send_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_read INTEGER DEFAULT 0,
        FOREIGN KEY (sender_id) REFERENCES users(id),
        FOREIGN KEY (receiver_id) REFERENCES users(id)
      )
    `);

    // 创建文件表（存储文件元数据）
    db.run(`
      CREATE TABLE IF NOT EXISTS files (
        id TEXT PRIMARY KEY,
        original_name TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_type TEXT NOT NULL,
        sha1_hash TEXT NOT NULL,
        uploader_id TEXT NOT NULL,
        create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploader_id) REFERENCES users(id)
      )
    `);

    // 数据库迁移：为 messages 表添加新字段
    db.all(`PRAGMA table_info(messages)`, [], (err, columns) => {
      if (!err && columns) {
        const columnNames = columns.map(col => col.name);
        if (!columnNames.includes('message_type')) {
          db.run(`ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT 'text'`);
          console.log('已添加 message_type 字段');
        }
        if (!columnNames.includes('file_id')) {
          db.run(`ALTER TABLE messages ADD COLUMN file_id TEXT`);
          console.log('已添加 file_id 字段');
        }
      }
    });

    // 数据库迁移：为 files 表添加 duration 字段（音频时长）
    db.all(`PRAGMA table_info(files)`, [], (err, columns) => {
      if (!err && columns) {
        const columnNames = columns.map(col => col.name);
        if (!columnNames.includes('duration')) {
          db.run(`ALTER TABLE files ADD COLUMN duration INTEGER DEFAULT 0`);
          console.log('已添加 duration 字段');
        }
      }
    });

    // 数据库迁移：为 messages 表添加 group_id 和 mention_ids 字段（群聊支持）
    db.all(`PRAGMA table_info(messages)`, [], (err, columns) => {
      if (!err && columns) {
        const columnNames = columns.map(col => col.name);
        if (!columnNames.includes('group_id')) {
          db.run(`ALTER TABLE messages ADD COLUMN group_id TEXT`);
          console.log('已添加 group_id 字段');
        }
        if (!columnNames.includes('mention_ids')) {
          db.run(`ALTER TABLE messages ADD COLUMN mention_ids TEXT`);
          console.log('已添加 mention_ids 字段');
        }
      }
    });

    // 数据库迁移：修改 receiver_id 允许 NULL（支持群消息）
    // SQLite 不支持 ALTER COLUMN，需要重建表
    db.all(`PRAGMA table_info(messages)`, [], (err, columns) => {
      if (!err && columns) {
        const receiverCol = columns.find(col => col.name === 'receiver_id');
        if (receiverCol && receiverCol.notnull === 1) {
          console.log('正在修改 messages 表，允许 receiver_id 为 NULL...');
          db.serialize(() => {
            db.run(`ALTER TABLE messages RENAME TO messages_old`);
            db.run(`
              CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                sender_id TEXT NOT NULL,
                receiver_id TEXT,
                content TEXT NOT NULL,
                message_type TEXT DEFAULT 'text',
                file_id TEXT,
                group_id TEXT,
                mention_ids TEXT,
                send_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_read INTEGER DEFAULT 0
              )
            `);
            db.run(`
              INSERT INTO messages (id, sender_id, receiver_id, content, message_type, file_id, group_id, mention_ids, send_time, is_read)
              SELECT id, sender_id, receiver_id, content, message_type, file_id, group_id, mention_ids, send_time, is_read
              FROM messages_old
            `);
            db.run(`DROP TABLE messages_old`);
            console.log('已修改 messages 表结构');
          });
        }
      }
    });
  }
});

// JWT 配置
const JWT_SECRET = process.env.JWT_SECRET || 'im-server-secret-2026'; // 生产环境请更换为复杂随机字符串
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 认证中间件
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ code: 401, message: '未提供令牌' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // 将用户信息挂载到 req
    next();
  } catch (err) {
    return res.status(401).json({ code: 401, message: '令牌无效或已过期' });
  }
};

// ====================== 用户相关接口 ======================
/**
 * 注册接口
 * POST /api/register
 * 参数: { username, password }
 */
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;

  // 参数校验
  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
  }

  try {
    // 密码加密
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 插入用户数据
    const userId = uuidv4();
    db.run(
      `INSERT INTO users (id, username, password) VALUES (?, ?, ?)`,
      [userId, username, hashedPassword],
      (err) => {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ code: 400, message: '用户名已存在' });
          }
          return res.status(500).json({ code: 500, message: '注册失败', error: err.message });
        }
        res.status(200).json({
          code: 200,
          message: '注册成功',
          data: { userId, username }
        });
      }
    );
  } catch (err) {
    res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
  }
});

/**
 * 登录接口
 * POST /api/login
 * 参数: { username, password }
 */
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ code: 400, message: '用户名和密码不能为空' });
  }

  // 查询用户
  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '登录失败', error: err.message });
    }
    if (!user) {
      return res.status(400).json({ code: 400, message: '用户名或密码错误' });
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ code: 400, message: '用户名或密码错误' });
    }

    // 生成 JWT 令牌
    const token = jwt.sign(
      { id: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(200).json({
      code: 200,
      message: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          avatar: user.avatar
        }
      }
    });
  });
});

// ====================== 用户信息相关接口 ======================
/**
 * 获取用户信息接口
 * GET /api/user/info
 * 需认证
 */
app.get('/api/user/info', authMiddleware, (req, res) => {
  const userId = req.user.id;

  db.get(`SELECT id, username, avatar FROM users WHERE id = ?`, [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '获取用户信息失败', error: err.message });
    }
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }
    res.status(200).json({
      code: 200,
      data: user
    });
  });
});

/**
 * 上传头像接口
 * POST /api/user/avatar
 * 参数: file (multipart/form-data)
 * 需认证
 */
app.post('/api/user/avatar', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ code: 400, message: '未上传文件' });
  }

  const userId = req.user.id;
  const fileBuffer = req.file.buffer;
  const mimeType = req.file.mimetype;

  // 检查是否是图片
  if (!mimeType.startsWith('image/')) {
    return res.status(400).json({ code: 400, message: '只能上传图片文件' });
  }

  // 计算文件名
  const ext = mimeType.split('/')[1] || 'png';
  const fileName = `${userId}_${Date.now()}.${ext}`;
  const avatarPath = path.join(avatarDir, fileName);

  // 保存文件
  fs.writeFile(avatarPath, fileBuffer, (err) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '保存头像失败', error: err.message });
    }

    // 更新用户头像URL
    const avatarUrl = `/uploads/avatars/${fileName}`;
    db.run(
      `UPDATE users SET avatar = ? WHERE id = ?`,
      [avatarUrl, userId],
      (err) => {
        if (err) {
          return res.status(500).json({ code: 500, message: '更新头像失败', error: err.message });
        }
        res.status(200).json({
          code: 200,
          message: '头像更新成功',
          data: { avatar: avatarUrl }
        });
      }
    );
  });
});

/**
 * 修改密码接口
 * POST /api/user/change-password
 * 参数: { oldPassword, newPassword }
 * 需认证
 */
app.post('/api/user/change-password', authMiddleware, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = req.user.id;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ code: 400, message: '原密码和新密码不能为空' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ code: 400, message: '新密码至少6位' });
  }

  // 查询用户
  db.get(`SELECT * FROM users WHERE id = ?`, [userId], async (err, user) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '查询用户失败', error: err.message });
    }
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }

    // 验证原密码
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ code: 400, message: '原密码错误' });
    }

    // 加密新密码
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // 更新密码
    db.run(
      `UPDATE users SET password = ? WHERE id = ?`,
      [hashedPassword, userId],
      (err) => {
        if (err) {
          return res.status(500).json({ code: 500, message: '修改密码失败', error: err.message });
        }
        res.status(200).json({
          code: 200,
          message: '密码修改成功'
        });
      }
    );
  });
});

// ====================== 好友相关接口 ======================
/**
 * 发送好友申请接口
 * POST /api/friend/add
 * 参数: { friendUsername }
 * 需认证
 */
app.post('/api/friend/add', authMiddleware, (req, res) => {
  const { friendUsername } = req.body;
  const userId = req.user.id;

  if (!friendUsername) {
    return res.status(400).json({ code: 400, message: '好友用户名不能为空' });
  }

  // 1. 查询好友是否存在
  db.get(`SELECT id, username FROM users WHERE username = ?`, [friendUsername], (err, friend) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '查询好友失败', error: err.message });
    }
    if (!friend) {
      return res.status(404).json({ code: 404, message: '好友不存在' });
    }
    if (friend.id === userId) {
      return res.status(400).json({ code: 400, message: '不能添加自己为好友' });
    }

    // 2. 检查是否已是好友
    db.get(
      `SELECT id FROM friends WHERE user_id = ? AND friend_id = ?`,
      [userId, friend.id],
      (err, existingFriend) => {
        if (err) {
          return res.status(500).json({ code: 500, message: '检查好友关系失败', error: err.message });
        }
        if (existingFriend) {
          return res.status(400).json({ code: 400, message: '已添加该好友' });
        }

        // 3. 检查是否已发送申请
        db.get(
          `SELECT id, status FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?`,
          [userId, friend.id],
          (err, existingRequest) => {
            if (err) {
              return res.status(500).json({ code: 500, message: '检查好友申请失败', error: err.message });
            }
            if (existingRequest && existingRequest.status === 'pending') {
              return res.status(400).json({ code: 400, message: '已发送好友申请，等待对方同意' });
            }

            // 4. 发送好友申请
            const requestId = uuidv4();
            db.run(
              `INSERT INTO friend_requests (id, from_user_id, to_user_id) VALUES (?, ?, ?)`,
              [requestId, userId, friend.id],
              (err) => {
                if (err) {
                  return res.status(500).json({ code: 500, message: '发送好友申请失败', error: err.message });
                }

                // 5. 通过 SSE 推送好友申请通知给对方
                const requestNotification = {
                  type: 'friend_request',
                  data: {
                    requestId,
                    fromUserId: userId,
                    fromUsername: req.user.username,
                    toUserId: friend.id,
                    createTime: new Date().toISOString()
                  }
                };
                sendSSENotification(friend.id, requestNotification);

                res.status(200).json({
                  code: 200,
                  message: '好友申请已发送',
                  data: { requestId, friendUsername }
                });
              }
            );
          }
        );
      }
    );
  });
});

/**
 * 删除好友接口
 * POST /api/friend/delete
 * 参数: { friendId }
 * 需认证
 */
app.post('/api/friend/delete', authMiddleware, (req, res) => {
  const { friendId } = req.body;
  const userId = req.user.id;

  if (!friendId) {
    return res.status(400).json({ code: 400, message: '好友ID不能为空' });
  }

  // 双向删除好友关系
  db.run(
    `DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)`,
    [userId, friendId, friendId, userId],
    function (err) {
      if (err) {
        return res.status(500).json({ code: 500, message: '删除好友失败', error: err.message });
      }
      if (this.changes === 0) {
        return res.status(400).json({ code: 400, message: '未找到该好友关系' });
      }
      res.status(200).json({
        code: 200,
        message: '删除好友成功'
      });
    }
  );
});

/**
 * 备注好友接口
 * POST /api/friend/remark
 * 参数: { friendId, remark }
 * 需认证
 */
app.post('/api/friend/remark', authMiddleware, (req, res) => {
  const { friendId, remark } = req.body;
  const userId = req.user.id;

  if (!friendId || remark === undefined) {
    return res.status(400).json({ code: 400, message: '好友ID和备注不能为空' });
  }

  db.run(
    `UPDATE friends SET remark = ? WHERE user_id = ? AND friend_id = ?`,
    [remark, userId, friendId],
    function (err) {
      if (err) {
        return res.status(500).json({ code: 500, message: '修改备注失败', error: err.message });
      }
      if (this.changes === 0) {
        return res.status(400).json({ code: 400, message: '未找到该好友关系' });
      }
      res.status(200).json({
        code: 200,
        message: '修改备注成功',
        data: { remark }
      });
    }
  );
});

/**
 * 获取好友列表接口
 * GET /api/friend/list
 * 需认证
 */
app.get('/api/friend/list', authMiddleware, (req, res) => {
  const userId = req.user.id;

  db.all(`
    SELECT f.id, f.friend_id, f.remark, u.username, u.avatar
    FROM friends f
    LEFT JOIN users u ON f.friend_id = u.id
    WHERE f.user_id = ?
  `, [userId], (err, friends) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '获取好友列表失败', error: err.message });
    }
    // 处理备注：如果没有备注则显示用户名
    const friendList = friends.map(friend => ({
      friendId: friend.friend_id,
      username: friend.username,
      avatar: friend.avatar,
      remark: friend.remark || friend.username
    }));
    res.status(200).json({
      code: 200,
      data: friendList
    });
  });
});

/**
 * 获取好友申请列表接口
 * GET /api/friend/requests
 * 需认证
 */
app.get('/api/friend/requests', authMiddleware, (req, res) => {
  const userId = req.user.id;

  db.all(`
    SELECT fr.id, fr.from_user_id, fr.status, fr.create_time, u.username, u.avatar as from_avatar
    FROM friend_requests fr
    LEFT JOIN users u ON fr.from_user_id = u.id
    WHERE fr.to_user_id = ? AND fr.status = 'pending'
    ORDER BY fr.create_time DESC
  `, [userId], (err, requests) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '获取好友申请失败', error: err.message });
    }
    const requestList = requests.map(req => ({
      requestId: req.id,
      fromUserId: req.from_user_id,
      fromUsername: req.username,
      fromAvatar: req.from_avatar,
      status: req.status,
      createTime: req.create_time
    }));
    res.status(200).json({
      code: 200,
      data: requestList
    });
  });
});

/**
 * 接受好友申请接口
 * POST /api/friend/accept
 * 参数: { requestId }
 * 需认证
 */
app.post('/api/friend/accept', authMiddleware, (req, res) => {
  const { requestId } = req.body;
  const userId = req.user.id;

  if (!requestId) {
    return res.status(400).json({ code: 400, message: '申请ID不能为空' });
  }

  // 1. 查询申请信息
  db.get(
    `SELECT * FROM friend_requests WHERE id = ? AND to_user_id = ? AND status = 'pending'`,
    [requestId, userId],
    (err, request) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '查询好友申请失败', error: err.message });
      }
      if (!request) {
        return res.status(400).json({ code: 400, message: '好友申请不存在或已处理' });
      }

      const fromUserId = request.from_user_id;

      // 2. 更新申请状态为已接受
      db.run(
        `UPDATE friend_requests SET status = 'accepted' WHERE id = ?`,
        [requestId],
        (err) => {
          if (err) {
            return res.status(500).json({ code: 500, message: '更新申请状态失败', error: err.message });
          }

          // 3. 双向添加好友关系
          const friendId1 = uuidv4();
          const friendId2 = uuidv4();

          db.run(
            `INSERT INTO friends (id, user_id, friend_id) VALUES (?, ?, ?)`,
            [friendId1, userId, fromUserId],
            (err) => {
              if (err) {
                return res.status(500).json({ code: 500, message: '添加好友失败', error: err.message });
              }

              db.run(
                `INSERT INTO friends (id, user_id, friend_id) VALUES (?, ?, ?)`,
                [friendId2, fromUserId, userId],
                (err) => {
                  if (err) {
                    return res.status(500).json({ code: 500, message: '添加好友失败', error: err.message });
                  }

                  // 4. 通知申请人好友申请已接受
                  sendSSENotification(fromUserId, {
                    type: 'friend_request_accepted',
                    data: {
                      requestId,
                      friendId: userId,
                      friendUsername: req.user.username
                    }
                  });

                  res.status(200).json({
                    code: 200,
                    message: '已接受好友申请'
                  });
                }
              );
            }
          );
        }
      );
    }
  );
});

/**
 * 拒绝好友申请接口
 * POST /api/friend/reject
 * 参数: { requestId }
 * 需认证
 */
app.post('/api/friend/reject', authMiddleware, (req, res) => {
  const { requestId } = req.body;
  const userId = req.user.id;

  if (!requestId) {
    return res.status(400).json({ code: 400, message: '申请ID不能为空' });
  }

  db.run(
    `UPDATE friend_requests SET status = 'rejected' WHERE id = ? AND to_user_id = ? AND status = 'pending'`,
    [requestId, userId],
    function (err) {
      if (err) {
        return res.status(500).json({ code: 500, message: '拒绝好友申请失败', error: err.message });
      }
      if (this.changes === 0) {
        return res.status(400).json({ code: 400, message: '好友申请不存在或已处理' });
      }
      res.status(200).json({
        code: 200,
        message: '已拒绝好友申请'
      });
    }
  );
});

// ====================== 消息相关接口 ======================
/**
 * 发送消息接口
 * POST /api/message/send
 * 参数: { receiverId, content }
 * 需认证
 */
app.post('/api/message/send', authMiddleware, (req, res) => {
  const { receiverId, content } = req.body;
  const senderId = req.user.id;

  if (!receiverId || !content) {
    return res.status(400).json({ code: 400, message: '接收者ID和消息内容不能为空' });
  }

  // 1. 检查接收者是否存在
  db.get(`SELECT id FROM users WHERE id = ?`, [receiverId], (err, receiver) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '查询接收者失败', error: err.message });
    }
    if (!receiver) {
      return res.status(404).json({ code: 404, message: '接收者不存在' });
    }

    // 2. 插入消息
    const messageId = uuidv4();
    db.run(
      `INSERT INTO messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)`,
      [messageId, senderId, receiverId, content],
      (err) => {
        if (err) {
          return res.status(500).json({ code: 500, message: '发送消息失败', error: err.message });
        }

        // 3. 推送消息到 SSE 客户端
        const messageData = {
          id: messageId,
          senderId,
          receiverId,
          content,
          sendTime: new Date().toISOString(),
          isRead: 0
        };
        sendSSEMessage(receiverId, messageData);

        res.status(200).json({
          code: 200,
          message: '消息发送成功',
          data: messageData
        });
      }
    );
  });
});

/**
 * 获取历史消息接口
 * GET /api/message/history?friendId=xxx
 * 需认证
 */
app.get('/api/message/history', authMiddleware, (req, res) => {
  const { friendId } = req.query;
  const userId = req.user.id;

  if (!friendId) {
    return res.status(400).json({ code: 400, message: '好友ID不能为空' });
  }

  db.all(`
    SELECT m.id, m.sender_id as senderId, m.receiver_id as receiverId, m.content, m.message_type as messageType, m.file_id as fileId, m.send_time as sendTime, m.is_read as isRead,
           f.file_size as fileSize, f.original_name as fileName, f.duration as duration
    FROM messages m
    LEFT JOIN files f ON m.file_id = f.id
    WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
    ORDER BY m.send_time ASC
  `, [userId, friendId, friendId, userId], (err, messages) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '获取历史消息失败', error: err.message });
    }

    // 标记来自该好友的消息为已读
    db.run(
      `UPDATE messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0`,
      [friendId, userId],
      (err) => {
        if (err) {
          console.error('标记消息已读失败:', err.message);
        }
      }
    );

    res.status(200).json({
      code: 200,
      data: messages
    });
  });
});

/**
 * 获取未读消息数接口
 * GET /api/message/unread
 * 需认证
 */
app.get('/api/message/unread', authMiddleware, (req, res) => {
  const userId = req.user.id;

  db.all(`
    SELECT sender_id as senderId, COUNT(*) as count
    FROM messages
    WHERE receiver_id = ? AND is_read = 0
    GROUP BY sender_id
  `, [userId], (err, result) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '获取未读消息数失败', error: err.message });
    }
    // 转换为对象格式 { friendId: count }
    const unreadCounts = {};
    result.forEach(item => {
      unreadCounts[item.senderId] = item.count;
    });
    res.status(200).json({
      code: 200,
      data: unreadCounts
    });
  });
});

/**
 * 清除聊天记录接口
 * POST /api/message/clear
 * 参数: { friendId }
 * 需认证
 */
app.post('/api/message/clear', authMiddleware, (req, res) => {
  const { friendId } = req.body;
  const userId = req.user.id;

  if (!friendId) {
    return res.status(400).json({ code: 400, message: '好友ID不能为空' });
  }

  // 1. 查询所有涉及文件的聊天记录
  db.all(`
    SELECT m.file_id, f.storage_path, f.id as fileId
    FROM messages m
    LEFT JOIN files f ON m.file_id = f.id
    WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
      AND m.file_id IS NOT NULL
  `, [userId, friendId, friendId, userId], (err, fileMessages) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '查询文件消息失败', error: err.message });
    }

    // 2. 删除物理文件
    const filesToDelete = [];
    const fileIdsToDelete = [];
    fileMessages.forEach(msg => {
      if (msg.storage_path && fs.existsSync(msg.storage_path)) {
        filesToDelete.push(msg.storage_path);
      }
      if (msg.fileId) {
        fileIdsToDelete.push(msg.fileId);
      }
    });

    // 删除文件
    filesToDelete.forEach(filePath => {
      try {
        fs.unlinkSync(filePath);
        console.log('已删除文件:', filePath);
      } catch (e) {
        console.error('删除文件失败:', filePath, e.message);
      }
    });

    // 3. 删除文件记录
    if (fileIdsToDelete.length > 0) {
      db.run(
        `DELETE FROM files WHERE id IN (${fileIdsToDelete.map(() => '?').join(',')})`,
        fileIdsToDelete,
        (err) => {
          if (err) {
            console.error('删除文件记录失败:', err.message);
          }
        }
      );
    }

    // 4. 删除消息记录
    db.run(
      `DELETE FROM messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)`,
      [userId, friendId, friendId, userId],
      function (err) {
        if (err) {
          return res.status(500).json({ code: 500, message: '清除聊天记录失败', error: err.message });
        }

        res.status(200).json({
          code: 200,
          message: '聊天记录已清除',
          data: {
            deletedMessages: this.changes,
            deletedFiles: filesToDelete.length
          }
        });
      }
    );
  });
});

// ====================== 群消息相关接口 ======================
/**
 * 发送群消息接口
 * POST /api/message/send-group
 * 参数: { groupId, content, mentionIds }
 * 需认证
 */
app.post('/api/message/send-group', authMiddleware, (req, res) => {
  const { groupId, content, mentionIds } = req.body;
  const senderId = req.user.id;

  if (!groupId || !content) {
    return res.status(400).json({ code: 400, message: '群组ID和消息内容不能为空' });
  }

  // 检查是否是群成员
  db.get(
    `SELECT gm.role, g.name as groupName FROM group_members gm LEFT JOIN groups g ON gm.group_id = g.id WHERE gm.group_id = ? AND gm.user_id = ?`,
    [groupId, senderId],
    (err, member) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '查询失败', error: err.message });
      }
      if (!member) {
        return res.status(403).json({ code: 403, message: '不是群成员' });
      }

      // 插入消息
      const messageId = uuidv4();
      const mentionIdsJson = mentionIds ? JSON.stringify(mentionIds) : null;
      db.run(
        `INSERT INTO messages (id, sender_id, receiver_id, content, group_id, mention_ids) VALUES (?, ?, ?, ?, ?, ?)`,
        [messageId, senderId, null, content, groupId, mentionIdsJson],
        (err) => {
          if (err) {
            return res.status(500).json({ code: 500, message: '发送消息失败', error: err.message });
          }

          // 构建消息数据
          const messageData = {
            id: messageId,
            senderId,
            groupId,
            content,
            messageType: 'text',
            mentionIds: mentionIds || [],
            sendTime: new Date().toISOString(),
            senderUsername: req.user.username
          };

          // 推送给所有群成员（排除发送者）
          db.all(
            `SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?`,
            [groupId, senderId],
            (err, members) => {
              if (!err && members) {
                members.forEach(m => {
                  sendSSENotification(m.user_id, {
                    type: 'group_message',
                    data: {
                      ...messageData,
                      groupName: member.groupName
                    }
                  });
                });
              }
            }
          );

          res.status(200).json({
            code: 200,
            message: '消息发送成功',
            data: messageData
          });
        }
      );
    }
  );
});

/**
 * 获取群消息历史接口
 * GET /api/message/group-history?groupId=xxx
 * 需认证
 */
app.get('/api/message/group-history', authMiddleware, (req, res) => {
  const { groupId } = req.query;
  const userId = req.user.id;

  if (!groupId) {
    return res.status(400).json({ code: 400, message: '群组ID不能为空' });
  }

  // 检查是否是群成员
  db.get(
    `SELECT id FROM group_members WHERE group_id = ? AND user_id = ?`,
    [groupId, userId],
    (err, member) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '查询失败', error: err.message });
      }
      if (!member) {
        return res.status(403).json({ code: 403, message: '不是群成员' });
      }

      db.all(`
        SELECT m.id, m.sender_id as senderId, m.group_id as groupId, m.content, m.message_type as messageType, m.file_id as fileId, m.mention_ids as mentionIds, m.send_time as sendTime,
               u.username as senderUsername,
               f.file_size as fileSize, f.original_name as fileName, f.duration as duration
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        LEFT JOIN files f ON m.file_id = f.id
        WHERE m.group_id = ?
        ORDER BY m.send_time ASC
      `, [groupId], (err, messages) => {
        if (err) {
          return res.status(500).json({ code: 500, message: '获取群消息历史失败', error: err.message });
        }

        const messageList = messages.map(msg => ({
          id: msg.id,
          senderId: msg.senderId,
          senderUsername: msg.senderUsername,
          groupId: msg.groupId,
          content: msg.content,
          messageType: msg.messageType || 'text',
          fileId: msg.fileId,
          fileSize: msg.fileSize,
          fileName: msg.fileName,
          duration: msg.duration,
          mentionIds: msg.mentionIds ? JSON.parse(msg.mentionIds) : [],
          sendTime: msg.sendTime
        }));

        res.status(200).json({
          code: 200,
          data: messageList
        });
      });
    }
  );
});

/**
 * 发送群文件消息接口
 * POST /api/message/send-group-file
 * 参数: { groupId, fileId, mentionIds }
 * 需认证
 */
app.post('/api/message/send-group-file', authMiddleware, (req, res) => {
  const { groupId, fileId, mentionIds } = req.body;
  const senderId = req.user.id;

  if (!groupId || !fileId) {
    return res.status(400).json({ code: 400, message: '群组ID和文件ID不能为空' });
  }

  // 检查是否是群成员
  db.get(
    `SELECT gm.role, g.name as groupName FROM group_members gm LEFT JOIN groups g ON gm.group_id = g.id WHERE gm.group_id = ? AND gm.user_id = ?`,
    [groupId, senderId],
    (err, member) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '查询失败', error: err.message });
      }
      if (!member) {
        return res.status(403).json({ code: 403, message: '不是群成员' });
      }

      // 查询文件信息
      db.get(`SELECT * FROM files WHERE id = ?`, [fileId], (err, file) => {
        if (err) {
          return res.status(500).json({ code: 500, message: '查询文件失败', error: err.message });
        }
        if (!file) {
          return res.status(404).json({ code: 404, message: '文件不存在' });
        }

        // 插入消息
        const messageId = uuidv4();
        const messageType = file.file_type === 'image' ? 'image' : (file.file_type === 'audio' ? 'audio' : 'file');
        const mentionIdsJson = mentionIds ? JSON.stringify(mentionIds) : null;
        db.run(
          `INSERT INTO messages (id, sender_id, receiver_id, content, message_type, file_id, group_id, mention_ids) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [messageId, senderId, null, file.original_name, messageType, fileId, groupId, mentionIdsJson],
          (err) => {
            if (err) {
              return res.status(500).json({ code: 500, message: '发送消息失败', error: err.message });
            }

            const messageData = {
              id: messageId,
              senderId,
              groupId,
              content: file.original_name,
              messageType,
              fileId,
              fileSize: file.file_size,
              duration: file.duration,
              mentionIds: mentionIds || [],
              sendTime: new Date().toISOString(),
              senderUsername: req.user.username
            };

            // 推送给所有群成员（排除发送者）
            db.all(
              `SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ?`,
              [groupId, senderId],
              (err, members) => {
                if (!err && members) {
                  members.forEach(m => {
                    sendSSENotification(m.user_id, {
                      type: 'group_message',
                      data: {
                        ...messageData,
                        groupName: member.groupName
                      }
                    });
                  });
                }
              }
            );

            res.status(200).json({
              code: 200,
              message: '消息发送成功',
              data: messageData
            });
          }
        );
      });
    }
  );
});

// ====================== 文件相关接口 ======================
/**
 * 上传文件接口
 * POST /api/file/upload
 * 参数: file (multipart/form-data)
 * 需认证
 */
app.post('/api/file/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ code: 400, message: '未上传文件' });
  }

  const userId = req.user.id;
  // multer 使用 latin1 编码，需要转换为 utf8 正确处理中文文件名
  const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const fileBuffer = req.file.buffer;
  const fileSize = req.file.size;
  const mimeType = req.file.mimetype;
  const duration = parseInt(req.body.duration) || 0; // 音频时长（秒）

  // 计算 SHA1
  const sha1Hash = calculateSHA1(fileBuffer);

  // 按SHA1前两位分目录存储
  const subDir = sha1Hash.substring(0, 2);
  const storageName = sha1Hash.substring(2);
  const targetDir = path.join(chatDir, subDir);

  // 创建子目录
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const storagePath = path.join(targetDir, storageName);

  // 保存文件
  fs.writeFile(storagePath, fileBuffer, (err) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '文件保存失败', error: err.message });
    }

    // 判断文件类型（图片、音频或其他）
    const isImage = mimeType.startsWith('image/');
    const isAudio = mimeType.startsWith('audio/') || mimeType === 'audio/webm' || mimeType === 'audio/ogg' || mimeType === 'audio/mp4';
    const fileType = isImage ? 'image' : (isAudio ? 'audio' : 'file');

    // 存入数据库
    const fileId = uuidv4();
    db.run(
      `INSERT INTO files (id, original_name, storage_path, file_size, file_type, sha1_hash, uploader_id, duration) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [fileId, originalName, storagePath, fileSize, fileType, sha1Hash, userId, duration],
      (err) => {
        if (err) {
          // 删除已保存的文件
          fs.unlinkSync(storagePath);
          return res.status(500).json({ code: 500, message: '文件记录保存失败', error: err.message });
        }

        res.status(200).json({
          code: 200,
          message: '文件上传成功',
          data: {
            fileId,
            originalName,
            fileSize,
            fileType,
            mimeType,
            duration
          }
        });
      }
    );
  });
});

/**
 * 下载文件接口
 * GET /api/file/download/:fileId?token=xxx
 * 支持通过 query 参数传递 token
 */
app.get('/api/file/download/:fileId', (req, res) => {
  const { fileId } = req.params;
  const token = req.query.token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ code: 401, message: '未提供令牌' });
  }

  try {
    jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ code: 401, message: '令牌无效或已过期' });
  }

  db.get(`SELECT * FROM files WHERE id = ?`, [fileId], (err, file) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '查询文件失败', error: err.message });
    }
    if (!file) {
      return res.status(404).json({ code: 404, message: '文件不存在' });
    }

    // 检查文件是否存在
    if (!fs.existsSync(file.storage_path)) {
      return res.status(404).json({ code: 404, message: '文件已丢失' });
    }

    // 设置响应头，正确处理中文文件名
    // 使用 RFC 5987 编码，兼容各浏览器
    const encodedFileName = encodeURIComponent(file.original_name);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.sendFile(file.storage_path);
  });
});

/**
 * 发送文件/图片消息接口
 * POST /api/message/send-file
 * 参数: { receiverId, fileId }
 * 需认证
 */
app.post('/api/message/send-file', authMiddleware, (req, res) => {
  const { receiverId, fileId } = req.body;
  const senderId = req.user.id;

  if (!receiverId || !fileId) {
    return res.status(400).json({ code: 400, message: '接收者ID和文件ID不能为空' });
  }

  // 查询文件信息
  db.get(`SELECT * FROM files WHERE id = ?`, [fileId], (err, file) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '查询文件失败', error: err.message });
    }
    if (!file) {
      return res.status(404).json({ code: 404, message: '文件不存在' });
    }

    // 检查接收者是否存在
    db.get(`SELECT id FROM users WHERE id = ?`, [receiverId], (err, receiver) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '查询接收者失败', error: err.message });
      }
      if (!receiver) {
        return res.status(404).json({ code: 404, message: '接收者不存在' });
      }

      // 插入消息
      const messageId = uuidv4();
      const messageType = file.file_type === 'image' ? 'image' : (file.file_type === 'audio' ? 'audio' : 'file');
      db.run(
        `INSERT INTO messages (id, sender_id, receiver_id, content, message_type, file_id) VALUES (?, ?, ?, ?, ?, ?)`,
        [messageId, senderId, receiverId, file.original_name, messageType, fileId],
        (err) => {
          if (err) {
            return res.status(500).json({ code: 500, message: '发送消息失败', error: err.message });
          }

          // 推送消息到 SSE 客户端
          const messageData = {
            id: messageId,
            senderId,
            receiverId,
            content: file.original_name,
            messageType,
            fileId,
            fileSize: file.file_size,
            duration: file.duration,
            sendTime: new Date().toISOString(),
            isRead: 0
          };
          sendSSEMessage(receiverId, messageData);

          res.status(200).json({
            code: 200,
            message: '消息发送成功',
            data: messageData
          });
        }
      );
    });
  });
});

// ====================== WebRTC 相关接口 ======================
/**
 * 获取 WebRTC ICE 配置（含 TURN 短效凭证）
 * GET /api/webrtc/ice-config
 * 需认证
 */
app.get('/api/webrtc/ice-config', authMiddleware, (req, res) => {
  const userId = req.user.id;

  const iceServers = [];

  // 添加 STUN 服务器
  if (WEBRTC_CONFIG.stunUrls) {
    const stunUrls = WEBRTC_CONFIG.stunUrls.split(',').map(url => url.trim());
    iceServers.push({ urls: stunUrls });
  }

  // 添加 TURN 服务器（带短效凭证）
  const turnCredentials = generateTurnCredentials(userId);
  if (turnCredentials) {
    const turnUrls = turnCredentials.urls.split(',').map(url => url.trim());
    iceServers.push({
      urls: turnUrls,
      username: turnCredentials.username,
      credential: turnCredentials.credential
    });
  }

  res.status(200).json({
    code: 200,
    data: {
      iceServers,
      expiry: WEBRTC_CONFIG.credentialExpiry
    }
  });
});

/**
 * 发送 WebRTC 信令消息
 * POST /api/webrtc/signal
 * 参数: { targetUserId, signalType, signalData }
 * signalType: offer/answer/ice_candidate/hangup/call_request/call_reject/call_accept
 * 需认证
 */
app.post('/api/webrtc/signal', authMiddleware, (req, res) => {
  const { targetUserId, signalType, signalData, callType } = req.body;
  const senderId = req.user.id;

  if (!targetUserId || !signalType) {
    return res.status(400).json({ code: 400, message: '目标用户ID和信令类型不能为空' });
  }

  // 验证目标用户存在
  db.get(`SELECT id, username FROM users WHERE id = ?`, [targetUserId], (err, targetUser) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '查询目标用户失败', error: err.message });
    }
    if (!targetUser) {
      return res.status(404).json({ code: 404, message: '目标用户不存在' });
    }

    // 通过 SSE 发送信令消息
    const signalMessage = {
      type: `call_${signalType}`,
      data: {
        senderId,
        senderUsername: req.user.username,
        targetUserId,
        signalData,
        callType,
        timestamp: new Date().toISOString()
      }
    };
    sendSSENotification(targetUserId, signalMessage);

    res.status(200).json({
      code: 200,
      message: '信令发送成功'
    });
  });
});

// ====================== 群组相关接口 ======================
/**
 * 创建群组接口
 * POST /api/group/create
 * 参数: { name, memberIds }
 * 需认证
 */
app.post('/api/group/create', authMiddleware, (req, res) => {
  const { name, memberIds } = req.body;
  const userId = req.user.id;

  if (!name) {
    return res.status(400).json({ code: 400, message: '群组名称不能为空' });
  }

  if (!memberIds || memberIds.length < 1) {
    return res.status(400).json({ code: 400, message: '至少需要一名成员' });
  }

  // 创建群组
  const groupId = uuidv4();
  db.run(
    `INSERT INTO groups (id, name, owner_id) VALUES (?, ?, ?)`,
    [groupId, name, userId],
    (err) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '创建群组失败', error: err.message });
      }

      // 添加群主为成员（role = 'owner')
      const ownerMemberId = uuidv4();
      db.run(
        `INSERT INTO group_members (id, group_id, user_id, role) VALUES (?, ?, ?, 'owner')`,
        [ownerMemberId, groupId, userId],
        (err) => {
          if (err) {
            return res.status(500).json({ code: 500, message: '添加群主失败', error: err.message });
          }

          // 添加其他成员
          const insertMember = (memberId, callback) => {
            const id = uuidv4();
            db.run(
              `INSERT INTO group_members (id, group_id, user_id, role) VALUES (?, ?, ?, 'member')`,
              [id, groupId, memberId],
              callback
            );
          };

          // 批量添加成员
          let addedCount = 0;
          memberIds.forEach((memberId, index) => {
            if (memberId === userId) return; // 跳过群主
            insertMember(memberId, (err) => {
              if (!err) addedCount++;
              if (index === memberIds.length - 1) {
                // 通知所有成员加入群组
                memberIds.forEach(mId => {
                  if (mId !== userId) {
                    sendSSENotification(mId, {
                      type: 'group_invite_approved',
                      data: { groupId, groupName: name, inviterId: userId, inviterUsername: req.user.username }
                    });
                  }
                });

                res.status(200).json({
                  code: 200,
                  message: '群组创建成功',
                  data: { groupId, groupName: name, memberCount: memberIds.length }
                });
              }
            });
          });

          // 如果只有群主一人
          if (memberIds.length === 1 || memberIds.filter(id => id !== userId).length === 0) {
            res.status(200).json({
              code: 200,
              message: '群组创建成功',
              data: { groupId, groupName: name, memberCount: 1 }
            });
          }
        }
      );
    }
  );
});

/**
 * 获取群组列表接口
 * GET /api/group/list
 * 需认证
 */
app.get('/api/group/list', authMiddleware, (req, res) => {
  const userId = req.user.id;

  db.all(`
    SELECT g.id, g.name, g.avatar, g.owner_id, gm.role
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    WHERE gm.user_id = ?
    ORDER BY g.create_time DESC
  `, [userId], (err, groups) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '获取群组列表失败', error: err.message });
    }

    const groupList = groups.map(g => ({
      groupId: g.id,
      groupName: g.name,
      avatar: g.avatar,
      ownerId: g.owner_id,
      role: g.role
    }));

    res.status(200).json({
      code: 200,
      data: groupList
    });
  });
});

/**
 * 获取群组详情接口
 * GET /api/group/:groupId/info
 * 需认证
 */
app.get('/api/group/:groupId/info', authMiddleware, (req, res) => {
  const { groupId } = req.params;
  const userId = req.user.id;

  // 检查是否是群成员
  db.get(
    `SELECT gm.role FROM group_members gm WHERE gm.group_id = ? AND gm.user_id = ?`,
    [groupId, userId],
    (err, member) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '查询失败', error: err.message });
      }
      if (!member) {
        return res.status(403).json({ code: 403, message: '不是群成员' });
      }

      db.get(
        `SELECT g.id, g.name, g.avatar, g.owner_id, g.create_time, u.username as ownerUsername
         FROM groups g
         LEFT JOIN users u ON g.owner_id = u.id
         WHERE g.id = ?`,
        [groupId],
        (err, group) => {
          if (err) {
            return res.status(500).json({ code: 500, message: '获取群组信息失败', error: err.message });
          }
          if (!group) {
            return res.status(404).json({ code: 404, message: '群组不存在' });
          }

          // 获取成员数量
          db.get(
            `SELECT COUNT(*) as memberCount FROM group_members WHERE group_id = ?`,
            [groupId],
            (err, countResult) => {
              if (err) {
                return res.status(500).json({ code: 500, message: '获取成员数量失败', error: err.message });
              }

              res.status(200).json({
                code: 200,
                data: {
                  groupId: group.id,
                  groupName: group.name,
                  avatar: group.avatar,
                  ownerId: group.owner_id,
                  ownerUsername: group.owner_username,
                  createTime: group.create_time,
                  memberCount: countResult.memberCount,
                  myRole: member.role
                }
              });
            }
          );
        }
      );
    }
  );
});

/**
 * 获取群成员列表接口
 * GET /api/group/:groupId/members
 * 需认证
 */
app.get('/api/group/:groupId/members', authMiddleware, (req, res) => {
  const { groupId } = req.params;
  const userId = req.user.id;

  // 检查是否是群成员
  db.get(
    `SELECT id FROM group_members WHERE group_id = ? AND user_id = ?`,
    [groupId, userId],
    (err, member) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '查询失败', error: err.message });
      }
      if (!member) {
        return res.status(403).json({ code: 403, message: '不是群成员' });
      }

      db.all(`
        SELECT gm.user_id, gm.role, gm.join_time, u.username, u.avatar
        FROM group_members gm
        LEFT JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id = ?
        ORDER BY
          CASE gm.role
            WHEN 'owner' THEN 1
            WHEN 'admin' THEN 2
            WHEN 'member' THEN 3
          END,
          gm.join_time ASC
      `, [groupId], (err, members) => {
        if (err) {
          return res.status(500).json({ code: 500, message: '获取群成员失败', error: err.message });
        }

        const memberList = members.map(m => ({
          userId: m.user_id,
          username: m.username,
          avatar: m.avatar,
          role: m.role,
          joinTime: m.join_time
        }));

        res.status(200).json({
          code: 200,
          data: memberList
        });
      });
    }
  );
});

/**
 * 邀请成员接口（所有成员可邀请，需管理员审核）
 * POST /api/group/invite
 * 参数: { groupId, inviteeId }
 * 需认证
 */
app.post('/api/group/invite', authMiddleware, (req, res) => {
  const { groupId, inviteeId } = req.body;
  const userId = req.user.id;

  if (!groupId || !inviteeId) {
    return res.status(400).json({ code: 400, message: '群组ID和被邀请者ID不能为空' });
  }

  // 检查邀请者是否是群成员
  db.get(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
    [groupId, userId],
    (err, inviterMember) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '查询失败', error: err.message });
      }
      if (!inviterMember) {
        return res.status(403).json({ code: 403, message: '不是群成员，无法邀请' });
      }

      // 检查被邀请者是否已是成员
      db.get(
        `SELECT id FROM group_members WHERE group_id = ? AND user_id = ?`,
        [groupId, inviteeId],
        (err, existingMember) => {
          if (err) {
            return res.status(500).json({ code: 500, message: '查询失败', error: err.message });
          }
          if (existingMember) {
            return res.status(400).json({ code: 400, message: '该用户已是群成员' });
          }

          // 检查被邀请者是否存在
          db.get(
            `SELECT id, username FROM users WHERE id = ?`,
            [inviteeId],
            (err, invitee) => {
              if (err) {
                return res.status(500).json({ code: 500, message: '查询用户失败', error: err.message });
              }
              if (!invitee) {
                return res.status(404).json({ code: 404, message: '被邀请用户不存在' });
              }

              // 获取群组信息
              db.get(
                `SELECT name FROM groups WHERE id = ?`,
                [groupId],
                (err, group) => {
                  if (err || !group) {
                    return res.status(500).json({ code: 500, message: '获取群组信息失败' });
                  }

                  // 创建邀请记录
                  const inviteId = uuidv4();
                  db.run(
                    `INSERT INTO group_invites (id, group_id, inviter_id, invitee_id) VALUES (?, ?, ?, ?)`,
                    [inviteId, groupId, userId, inviteeId],
                    (err) => {
                      if (err) {
                        return res.status(500).json({ code: 500, message: '创建邀请失败', error: err.message });
                      }

                      // 通知群主和管理员有新的待审核邀请
                      db.all(
                        `SELECT user_id FROM group_members WHERE group_id = ? AND role IN ('owner', 'admin')`,
                        [groupId],
                        (err, admins) => {
                          if (!err && admins) {
                            admins.forEach(admin => {
                              sendSSENotification(admin.user_id, {
                                type: 'group_invite_pending',
                                data: {
                                  inviteId,
                                  groupId,
                                  groupName: group.name,
                                  inviterId: userId,
                                  inviterUsername: req.user.username,
                                  inviteeId,
                                  inviteeUsername: invitee.username
                                }
                              });
                            });
                          }
                        }
                      );

                      res.status(200).json({
                        code: 200,
                        message: '邀请已发送，等待管理员审核',
                        data: { inviteId }
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
});

/**
 * 获取待审核邀请列表接口
 * GET /api/group/invites
 * 参数: { groupId }
 * 需认证（群主/管理员）
 */
app.get('/api/group/invites', authMiddleware, (req, res) => {
  const { groupId } = req.query;
  const userId = req.user.id;

  if (!groupId) {
    return res.status(400).json({ code: 400, message: '群组ID不能为空' });
  }

  // 检查是否是群主或管理员
  db.get(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
    [groupId, userId],
    (err, member) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '查询失败', error: err.message });
      }
      if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
        return res.status(403).json({ code: 403, message: '只有群主或管理员可以查看邀请列表' });
      }

      db.all(`
        SELECT gi.id, gi.group_id, gi.inviter_id, gi.invitee_id, gi.create_time,
               u1.username as inviterUsername, u2.username as inviteeUsername, g.name as groupName
        FROM group_invites gi
        LEFT JOIN users u1 ON gi.inviter_id = u1.id
        LEFT JOIN users u2 ON gi.invitee_id = u2.id
        LEFT JOIN groups g ON gi.group_id = g.id
        WHERE gi.group_id = ? AND gi.status = 'pending'
        ORDER BY gi.create_time DESC
      `, [groupId], (err, invites) => {
        if (err) {
          return res.status(500).json({ code: 500, message: '获取邀请列表失败', error: err.message });
        }

        const inviteList = invites.map(inv => ({
          inviteId: inv.id,
          groupId: inv.group_id,
          groupName: inv.group_name,
          inviterId: inv.inviter_id,
          inviterUsername: inv.inviter_username,
          inviteeId: inv.invitee_id,
          inviteeUsername: inv.invitee_username,
          createTime: inv.create_time
        }));

        res.status(200).json({
          code: 200,
          data: inviteList
        });
      });
    }
  );
});

/**
 * 审核邀请接口
 * POST /api/group/approve-invite
 * 参数: { inviteId, approve }
 * 需认证（群主/管理员）
 */
app.post('/api/group/approve-invite', authMiddleware, (req, res) => {
  const { inviteId, approve } = req.body;
  const userId = req.user.id;

  if (!inviteId) {
    return res.status(400).json({ code: 400, message: '邀请ID不能为空' });
  }

  // 查询邀请信息
  db.get(
    `SELECT gi.*, g.name as groupName, u.username as inviteeUsername
     FROM group_invites gi
     LEFT JOIN groups g ON gi.group_id = g.id
     LEFT JOIN users u ON gi.invitee_id = u.id
     WHERE gi.id = ? AND gi.status = 'pending'`,
    [inviteId],
    (err, invite) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '查询失败', error: err.message });
      }
      if (!invite) {
        return res.status(404).json({ code: 404, message: '邀请不存在或已处理' });
      }

      // 检查审核者是否是群主或管理员
      db.get(
        `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
        [invite.group_id, userId],
        (err, member) => {
          if (err) {
            return res.status(500).json({ code: 500, message: '查询失败', error: err.message });
          }
          if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
            return res.status(403).json({ code: 403, message: '只有群主或管理员可以审核邀请' });
          }

          if (approve) {
            // 通过邀请，添加成员
            const newMemberId = uuidv4();
            db.run(
              `INSERT INTO group_members (id, group_id, user_id, role) VALUES (?, ?, ?, 'member')`,
              [newMemberId, invite.group_id, invite.invitee_id],
              (err) => {
                if (err) {
                  return res.status(500).json({ code: 500, message: '添加成员失败', error: err.message });
                }

                // 更新邀请状态
                db.run(
                  `UPDATE group_invites SET status = 'approved' WHERE id = ?`,
                  [inviteId],
                  (err) => {
                    if (err) {
                      console.error('更新邀请状态失败:', err.message);
                    }
                  }
                );

                // 通知被邀请者
                sendSSENotification(invite.invitee_id, {
                  type: 'group_invite_approved',
                  data: {
                    groupId: invite.group_id,
                    groupName: invite.groupName,
                    inviterId: invite.inviter_id
                  }
                });

                // 通知所有群成员有新成员加入
                db.all(
                  `SELECT user_id FROM group_members WHERE group_id = ?`,
                  [invite.group_id],
                  (err, members) => {
                    if (!err && members) {
                      members.forEach(m => {
                        if (m.user_id !== invite.invitee_id) {
                          sendSSENotification(m.user_id, {
                            type: 'group_member_joined',
                            data: {
                              groupId: invite.group_id,
                              groupName: invite.groupName,
                              newMemberId: invite.invitee_id,
                              newMemberUsername: invite.inviteeUsername
                            }
                          });
                        }
                      });
                    }
                  }
                );

                res.status(200).json({
                  code: 200,
                  message: '已通过邀请'
                });
              }
            );
          } else {
            // 拒绝邀请
            db.run(
              `UPDATE group_invites SET status = 'rejected' WHERE id = ?`,
              [inviteId],
              (err) => {
                if (err) {
                  return res.status(500).json({ code: 500, message: '拒绝邀请失败', error: err.message });
                }

                // 通知被邀请者
                sendSSENotification(invite.invitee_id, {
                  type: 'group_invite_rejected',
                  data: {
                    groupId: invite.group_id,
                    groupName: invite.groupName
                  }
                });

                res.status(200).json({
                  code: 200,
                  message: '已拒绝邀请'
                });
              }
            );
          }
        }
      );
    }
  );
});

/**
 * 设置/取消管理员接口
 * POST /api/group/set-admin
 * 参数: { groupId, memberId, isAdmin }
 * 需认证（仅群主）
 */
app.post('/api/group/set-admin', authMiddleware, (req, res) => {
  const { groupId, memberId, isAdmin } = req.body;
  const userId = req.user.id;

  if (!groupId || !memberId) {
    return res.status(400).json({ code: 400, message: '群组ID和成员ID不能为空' });
  }

  // 检查是否是群主
  db.get(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
    [groupId, userId],
    (err, member) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '查询失败', error: err.message });
      }
      if (!member || member.role !== 'owner') {
        return res.status(403).json({ code: 403, message: '只有群主可以设置管理员' });
      }

      // 检查目标成员是否存在
      db.get(
        `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
        [groupId, memberId],
        (err, targetMember) => {
          if (err) {
            return res.status(500).json({ code: 500, message: '查询失败', error: err.message });
          }
          if (!targetMember) {
            return res.status(404).json({ code: 404, message: '成员不存在' });
          }
          if (targetMember.role === 'owner') {
            return res.status(400).json({ code: 400, message: '不能修改群主角色' });
          }

          const newRole = isAdmin ? 'admin' : 'member';
          db.run(
            `UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?`,
            [newRole, groupId, memberId],
            (err) => {
              if (err) {
                return res.status(500).json({ code: 500, message: '设置管理员失败', error: err.message });
              }

              // 通知目标成员
              sendSSENotification(memberId, {
                type: 'group_role_changed',
                data: { groupId, newRole }
              });

              res.status(200).json({
                code: 200,
                message: isAdmin ? '已设置为管理员' : '已取消管理员'
              });
            }
          );
        }
      );
    }
  );
});

/**
 * 移除成员接口
 * POST /api/group/remove-member
 * 参数: { groupId, memberId }
 * 需认证（群主/管理员）
 */
app.post('/api/group/remove-member', authMiddleware, (req, res) => {
  const { groupId, memberId } = req.body;
  const userId = req.user.id;

  if (!groupId || !memberId) {
    return res.status(400).json({ code: 400, message: '群组ID和成员ID不能为空' });
  }

  // 检查操作者权限
  db.get(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
    [groupId, userId],
    (err, operator) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '查询失败', error: err.message });
      }
      if (!operator || (operator.role !== 'owner' && operator.role !== 'admin')) {
        return res.status(403).json({ code: 403, message: '只有群主或管理员可以移除成员' });
      }

      // 检查目标成员
      db.get(
        `SELECT gm.role, u.username FROM group_members gm LEFT JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ? AND gm.user_id = ?`,
        [groupId, memberId],
        (err, targetMember) => {
          if (err) {
            return res.status(500).json({ code: 500, message: '查询失败', error: err.message });
          }
          if (!targetMember) {
            return res.status(404).json({ code: 404, message: '成员不存在' });
          }

          // 管理员不能移除群主或其他管理员
          if (operator.role === 'admin' && (targetMember.role === 'owner' || targetMember.role === 'admin')) {
            return res.status(403).json({ code: 403, message: '管理员不能移除群主或其他管理员' });
          }

          // 获取群组名称
          db.get(`SELECT name FROM groups WHERE id = ?`, [groupId], (err, group) => {
            const groupName = group ? group.name : '';

            // 移除成员
            db.run(
              `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`,
              [groupId, memberId],
              (err) => {
                if (err) {
                  return res.status(500).json({ code: 500, message: '移除成员失败', error: err.message });
                }

                // 通知被移除的成员
                sendSSENotification(memberId, {
                  type: 'group_removed',
                  data: { groupId, groupName }
                });

                // 通知其他成员
                db.all(
                  `SELECT user_id FROM group_members WHERE group_id = ?`,
                  [groupId],
                  (err, members) => {
                    if (!err && members) {
                      members.forEach(m => {
                        sendSSENotification(m.user_id, {
                          type: 'group_member_removed',
                          data: { groupId, groupName, removedMemberId: memberId, removedMemberUsername: targetMember.username }
                        });
                      });
                    }
                  }
                );

                res.status(200).json({
                  code: 200,
                  message: '已移除成员'
                });
              }
            );
          });
        }
      );
    }
  );
});

/**
 * 退出群组接口
 * POST /api/group/quit
 * 参数: { groupId }
 * 需认证
 */
app.post('/api/group/quit', authMiddleware, (req, res) => {
  const { groupId } = req.body;
  const userId = req.user.id;

  if (!groupId) {
    return res.status(400).json({ code: 400, message: '群组ID不能为空' });
  }

  // 检查是否是群成员
  db.get(
    `SELECT gm.role, u.username FROM group_members gm LEFT JOIN users u ON gm.user_id = u.id WHERE gm.group_id = ? AND gm.user_id = ?`,
    [groupId, userId],
    (err, member) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '查询失败', error: err.message });
      }
      if (!member) {
        return res.status(400).json({ code: 400, message: '不是群成员' });
      }

      // 获取群组信息
      db.get(`SELECT name, owner_id FROM groups WHERE id = ?`, [groupId], (err, group) => {
        if (err || !group) {
          return res.status(500).json({ code: 500, message: '获取群组信息失败' });
        }

        // 群主退出需要先转让群主身份
        if (member.role === 'owner') {
          // 查找下一个管理员或成员
          db.get(
            `SELECT user_id FROM group_members WHERE group_id = ? AND role = 'admin' ORDER BY join_time ASC LIMIT 1`,
            [groupId],
            (err, nextOwner) => {
              if (!nextOwner) {
                db.get(
                  `SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ? ORDER BY join_time ASC LIMIT 1`,
                  [groupId, userId],
                  (err, nextOwner) => {
                    if (!nextOwner) {
                      // 群里没有其他成员，解散群组
                      db.run(`DELETE FROM groups WHERE id = ?`, [groupId]);
                      db.run(`DELETE FROM group_members WHERE group_id = ?`, [groupId]);
                      db.run(`DELETE FROM group_invites WHERE group_id = ?`, [groupId]);
                      db.run(`DELETE FROM messages WHERE group_id = ?`, [groupId]);

                      res.status(200).json({
                        code: 200,
                        message: '群组已解散'
                      });
                      return;
                    }
                    transferAndQuit(nextOwner.user_id);
                  }
                );
              } else {
                transferAndQuit(nextOwner.user_id);
              }
            }
          );

          function transferAndQuit(newOwnerId) {
            // 转让群主
            db.run(
              `UPDATE group_members SET role = 'owner' WHERE group_id = ? AND user_id = ?`,
              [groupId, newOwnerId]
            );
            db.run(
              `UPDATE group_members SET role = 'member' WHERE group_id = ? AND user_id = ?`,
              [groupId, userId]
            );
            db.run(
              `UPDATE groups SET owner_id = ? WHERE id = ?`,
              [newOwnerId, groupId]
            );

            // 通知新群主
            sendSSENotification(newOwnerId, {
              type: 'group_owner_transferred',
              data: { groupId, groupName: group.name }
            });

            // 执行退出逻辑
            quitGroup();
          }
        } else {
          quitGroup();
        }

        function quitGroup() {
          // 删除成员记录
          db.run(
            `DELETE FROM group_members WHERE group_id = ? AND user_id = ?`,
            [groupId, userId],
            (err) => {
              if (err) {
                return res.status(500).json({ code: 500, message: '退出群组失败', error: err.message });
              }

              // 通知其他成员
              db.all(
                `SELECT user_id FROM group_members WHERE group_id = ?`,
                [groupId],
                (err, members) => {
                  if (!err && members) {
                    members.forEach(m => {
                      sendSSENotification(m.user_id, {
                        type: 'group_member_quit',
                        data: { groupId, groupName: group.name, quitMemberId: userId, quitMemberUsername: member.username }
                      });
                    });
                  }
                }
              );

              res.status(200).json({
                code: 200,
                message: '已退出群组'
              });
            }
          );
        }
      });
    }
  );
});

/**
 * 转让群主接口
 * POST /api/group/transfer
 * 参数: { groupId, newOwnerId }
 * 需认证（仅群主）
 */
app.post('/api/group/transfer', authMiddleware, (req, res) => {
  const { groupId, newOwnerId } = req.body;
  const userId = req.user.id;

  if (!groupId || !newOwnerId) {
    return res.status(400).json({ code: 400, message: '群组ID和新群主ID不能为空' });
  }

  // 检查是否是群主
  db.get(
    `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
    [groupId, userId],
    (err, member) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '查询失败', error: err.message });
      }
      if (!member || member.role !== 'owner') {
        return res.status(403).json({ code: 403, message: '只有群主可以转让群主身份' });
      }

      // 检查新群主是否是成员
      db.get(
        `SELECT role FROM group_members WHERE group_id = ? AND user_id = ?`,
        [groupId, newOwnerId],
        (err, newOwner) => {
          if (err) {
            return res.status(500).json({ code: 500, message: '查询失败', error: err.message });
          }
          if (!newOwner) {
            return res.status(400).json({ code: 400, message: '新群主必须是群成员' });
          }

          // 更新群主
          db.run(
            `UPDATE group_members SET role = 'member' WHERE group_id = ? AND user_id = ?`,
            [groupId, userId]
          );
          db.run(
            `UPDATE group_members SET role = 'owner' WHERE group_id = ? AND user_id = ?`,
            [groupId, newOwnerId]
          );
          db.run(
            `UPDATE groups SET owner_id = ? WHERE id = ?`,
            [newOwnerId, groupId]
          );

          // 通知新群主
          sendSSENotification(newOwnerId, {
            type: 'group_owner_transferred',
            data: { groupId }
          });

          res.status(200).json({
            code: 200,
            message: '已转让群主身份'
          });
        }
      );
    }
  );
});

// ====================== SSE 相关 ======================
// 存储 SSE 客户端连接（支持同一用户多个连接）
const sseClients = new Map(); // key: userId, value: Set of res 对象

/**
 * SSE 连接接口
 * GET /api/sse/connect?token=xxx
 * 支持 query 参数传递 token（EventSource 无法设置 header）
 */
app.get('/api/sse/connect', (req, res) => {
  // 从 query 参数获取 token
  const token = req.query.token;
  if (!token) {
    return res.status(401).json({ code: 401, message: '未提供令牌' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id;

    // 设置 SSE 响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // 立即发送响应头

    // 存储客户端连接（支持同一用户多个连接）
    if (!sseClients.has(userId)) {
      sseClients.set(userId, new Set());
    }
    sseClients.get(userId).add(res);
    const connectionCount = sseClients.get(userId).size;
    console.log(`用户 ${userId} 建立 SSE 连接，该用户连接数: ${connectionCount}, 总用户数: ${sseClients.size}`);

    // 发送初始消息
    res.write(`data: ${JSON.stringify({ type: 'connect', message: '连接成功' })}\n\n`);

    // 客户端断开连接时清理
    req.on('close', () => {
      const connections = sseClients.get(userId);
      if (connections) {
        connections.delete(res);
        if (connections.size === 0) {
          sseClients.delete(userId);
        }
      }
      console.log(`用户 ${userId} 断开 SSE 连接`);
    });
  } catch (err) {
    console.error('SSE token验证失败:', err.message);
    return res.status(401).json({ code: 401, message: '令牌无效或已过期' });
  }
});

/**
 * 向指定用户发送 SSE 消息（推送到该用户的所有连接）
 * @param {string} userId 用户ID
 * @param {object} message 消息内容
 */
function sendSSEMessage(userId, message) {
  const connections = sseClients.get(userId);
  if (connections && connections.size > 0) {
    connections.forEach(clientRes => {
      try {
        clientRes.write(`data: ${JSON.stringify({ type: 'message', data: message })}\n\n`);
      } catch (err) {
        console.error(`向用户 ${userId} 推送 SSE 消息失败:`, err.message);
        connections.delete(clientRes);
      }
    });
  } else {
    console.log(`用户 ${userId} 没有活跃的 SSE 连接`);
  }
}

/**
 * 向指定用户发送 SSE 通知（好友申请等）
 * @param {string} userId 用户ID
 * @param {object} notification 通知内容
 */
function sendSSENotification(userId, notification) {
  const connections = sseClients.get(userId);
  if (connections && connections.size > 0) {
    connections.forEach(clientRes => {
      try {
        clientRes.write(`data: ${JSON.stringify(notification)}\n\n`);
      } catch (err) {
        console.error(`向用户 ${userId} 推送 SSE 通知失败:`, err.message);
        connections.delete(clientRes);
      }
    });
  }
}

// 启动服务器
app.listen(PORT, () => {
  console.log(`IM 服务器运行在 http://localhost:${PORT}`);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('正在关闭服务器...');
  // 关闭所有 SSE 连接
  sseClients.forEach((connections) => {
    connections.forEach(res => res.end());
  });
  // 关闭数据库连接
  db.close((err) => {
    if (err) {
      console.error('关闭数据库失败:', err.message);
    } else {
      console.log('数据库连接已关闭');
    }
    process.exit(0);
  });
});