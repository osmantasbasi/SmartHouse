const express = require('express');
const session = require('express-session');
const mqtt = require('mqtt');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const { Server } = require('socket.io');
const http = require('http');
const authRoutes = require('./src/routes/auth');
const adminRoutes = require('./src/routes/admin');
const database = require('./src/config/database');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Authentication routes
app.use('/api/auth', authRoutes);

// Admin routes
app.use('/api/admin', adminRoutes);

// Authentication middleware for protected routes
const requireAuth = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Multer configuration for certificate uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/certificates';
    fs.ensureDirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    // Accept certificate files
    if (file.mimetype.includes('application/x-x509-ca-cert') || 
        file.originalname.match(/\.(crt|cer|pem|key)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece sertifika dosyaları (.crt, .cer, .pem, .key) kabul edilir!'));
    }
  }
});

// Global MQTT client variable with reconnection support
let mqttClient = null;
let connectionStatus = {
  connected: false,
  brokerAddress: '',
  port: '',
  lastConnected: null,
  error: null
};

// Reconnection configuration
let reconnectConfig = {
  enabled: false,
  maxRetries: 5,
  currentRetries: 0,
  retryDelay: 2000, // Start with 2 seconds
  maxRetryDelay: 30000, // Max 30 seconds
  connectionOptions: null,
  timeoutId: null
};

// Function to attempt reconnection
const attemptReconnection = () => {
  if (!reconnectConfig.enabled || reconnectConfig.currentRetries >= reconnectConfig.maxRetries) {
    if (reconnectConfig.currentRetries >= reconnectConfig.maxRetries) {
      // Send warning notification to all clients
      connectionStatus = {
        ...connectionStatus,
        connected: false,
        error: `Bağlantı başarısız! ${reconnectConfig.maxRetries} deneme yapıldı ancak broker'a bağlanılamadı.`
      };
      io.emit('connectionStatus', connectionStatus);
      io.emit('reconnectionFailed', {
        message: `MQTT broker bağlantısı başarısız! ${reconnectConfig.maxRetries} deneme yapıldı.`,
        retries: reconnectConfig.currentRetries,
        maxRetries: reconnectConfig.maxRetries
      });
    }
    reconnectConfig.enabled = false;
    return;
  }

  reconnectConfig.currentRetries++;
  console.log(`MQTT yeniden bağlanma denemesi ${reconnectConfig.currentRetries}/${reconnectConfig.maxRetries}`);
  
  // Update connection status to show retry attempt
  connectionStatus.error = `Yeniden bağlanma denemesi ${reconnectConfig.currentRetries}/${reconnectConfig.maxRetries}...`;
  io.emit('connectionStatus', connectionStatus);

  try {
    if (mqttClient) {
      mqttClient.end(true); // Force close
    }

    mqttClient = mqtt.connect(
      `${reconnectConfig.connectionOptions.protocol}://${reconnectConfig.connectionOptions.brokerAddress}`,
      reconnectConfig.connectionOptions
    );

    setupMqttEventHandlers();

  } catch (error) {
    console.error('Reconnection attempt failed:', error);
    scheduleNextReconnection();
  }
};

// Schedule next reconnection attempt
const scheduleNextReconnection = () => {
  if (reconnectConfig.timeoutId) {
    clearTimeout(reconnectConfig.timeoutId);
  }

  // Exponential backoff with jitter
  const delay = Math.min(
    reconnectConfig.retryDelay * Math.pow(2, reconnectConfig.currentRetries - 1),
    reconnectConfig.maxRetryDelay
  );
  
  reconnectConfig.timeoutId = setTimeout(attemptReconnection, delay);
};

// Setup MQTT event handlers
const setupMqttEventHandlers = () => {
  if (!mqttClient) return;

  mqttClient.on('connect', () => {
    console.log('MQTT bağlantısı başarılı');
    reconnectConfig.enabled = false;
    reconnectConfig.currentRetries = 0;
    
    if (reconnectConfig.timeoutId) {
      clearTimeout(reconnectConfig.timeoutId);
      reconnectConfig.timeoutId = null;
    }

    connectionStatus = {
      connected: true,
      brokerAddress: reconnectConfig.connectionOptions.brokerAddress,
      port: reconnectConfig.connectionOptions.port,
      lastConnected: new Date().toISOString(),
      error: null
    };
    io.emit('connectionStatus', connectionStatus);
  });

  mqttClient.on('error', (error) => {
          console.error('MQTT connection error:', error.message);
    connectionStatus = {
      ...connectionStatus,
      connected: false,
      error: error.message
    };
    io.emit('connectionStatus', connectionStatus);
    
    // Start reconnection if not already running
    if (!reconnectConfig.enabled && reconnectConfig.connectionOptions) {
      reconnectConfig.enabled = true;
      reconnectConfig.currentRetries = 0;
      attemptReconnection();
    }
  });

  mqttClient.on('close', () => {
    console.log('MQTT bağlantısı kapandı');
    connectionStatus.connected = false;
    io.emit('connectionStatus', connectionStatus);
    
    // Start reconnection if not already running and if it wasn't a manual disconnect
    if (!reconnectConfig.enabled && reconnectConfig.connectionOptions) {
      reconnectConfig.enabled = true;
      reconnectConfig.currentRetries = 0;
      scheduleNextReconnection();
    }
  });

  mqttClient.on('offline', () => {
    console.log('MQTT client offline');
    connectionStatus.connected = false;
    io.emit('connectionStatus', connectionStatus);
  });

  mqttClient.on('message', (topic, message, packet) => {
    const messageData = {
      topic,
      message: message.toString(),
      qos: packet.qos || 0,
      retain: packet.retain || false,
      timestamp: new Date().toISOString()
    };
    io.emit('mqttMessage', messageData);
  });
};

// Socket.IO connection
io.on('connection', (socket) => {
  // Send current connection status
  socket.emit('connectionStatus', connectionStatus);
  
  // Handle subscription requests from React app
  socket.on('subscribe', (data) => {
    const { topic, qos } = data;
    
    if (!mqttClient || !connectionStatus.connected) {
      socket.emit('subscriptionError', 'Not connected to broker');
      return;
    }

    if (!topic) {
      socket.emit('subscriptionError', 'Topic is required');
      return;
    }

    const subscribeOptions = {
      qos: qos ? parseInt(qos) : 0
    };

    mqttClient.subscribe(topic, subscribeOptions, (error) => {
      if (error) {
        socket.emit('subscriptionError', `Subscription error: ${error.message}`);
      } else {
        socket.emit('subscriptionConfirmed', topic);
      }
    });
  });

  // Handle unsubscription requests
  socket.on('unsubscribe', (data) => {
    const { topic } = data;
    
    if (!mqttClient || !connectionStatus.connected) {
      socket.emit('subscriptionError', 'Not connected to broker');
      return;
    }

    if (!topic) {
      socket.emit('subscriptionError', 'Topic is required');
      return;
    }

    mqttClient.unsubscribe(topic, (error) => {
      if (error) {
        socket.emit('subscriptionError', `Unsubscription error: ${error.message}`);
      }
    });
  });

  // Handle publish requests from React app
  socket.on('publish', (data) => {
    const { topic, message, qos, retain } = data;
    
    if (!mqttClient || !connectionStatus.connected) {
      socket.emit('publishError', 'Not connected to broker');
      return;
    }

    if (!topic || message === undefined) {
      socket.emit('publishError', 'Topic and message are required');
      return;
    }

    const publishOptions = {
      qos: qos ? parseInt(qos) : 0,
      retain: retain === true
    };

    const messageToSend = typeof message === 'string' ? message : JSON.stringify(message);

    mqttClient.publish(topic, messageToSend, publishOptions, (error) => {
      if (error) {
        socket.emit('publishError', `Publish error: ${error.message}`);
      }
    });
  });
  
  socket.on('disconnect', () => {
    // User disconnected
  });
});

// Upload certificate endpoint
app.post('/api/upload-certificate', requireAuth, upload.single('certificate'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Sertifika dosyası seçilmedi' });
    }
    
    res.json({ 
      success: true, 
              message: 'Certificate uploaded successfully',
      filename: req.file.filename,
      path: req.file.path
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// AWS certificate upload configuration
const awsUpload = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = 'uploads/aws-certificates';
      fs.ensureDirSync(uploadDir);
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const certType = req.body.certType;
      let filename;
      switch(certType) {
        case 'ca':
          filename = 'ca-cert.pem';
          break;
        case 'client':
          filename = 'client-cert.pem';
          break;
        case 'key':
          filename = 'client-key.pem';
          break;
        default:
          filename = file.originalname;
      }
      cb(null, filename);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.originalname.match(/\.(pem|crt|key)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece .pem, .crt, .key dosyaları kabul edilir!'));
    }
  }
});

// Upload AWS certificate endpoint
app.post('/api/upload-aws-certificate', requireAuth, awsUpload.single('awsCertificate'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'AWS sertifika dosyası seçilmedi' });
    }
    
    const { certType } = req.body;
    if (!['ca', 'client', 'key'].includes(certType)) {
      return res.status(400).json({ error: 'Geçersiz sertifika tipi' });
    }
    
    res.json({ 
      success: true, 
              message: `AWS ${certType} certificate uploaded successfully`,
      filename: req.file.filename,
      path: req.file.path,
      certType: certType
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get uploaded certificates
app.get('/api/certificates', requireAuth, async (req, res) => {
  try {
    const uploadDir = 'uploads/certificates';
    await fs.ensureDir(uploadDir);
    const files = await fs.readdir(uploadDir);
    res.json({ certificates: files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Connect to MQTT broker
app.post('/api/connect', requireAuth, async (req, res) => {
  try {
    const { brokerAddress, port, useTLS, certificateFile, username, password, cleanSession, useAwsCerts } = req.body;
    
    if (!brokerAddress || !port) {
      return res.status(400).json({ error: 'Broker adresi ve port gerekli' });
    }

    // Stop any existing reconnection attempts
    reconnectConfig.enabled = false;
    reconnectConfig.currentRetries = 0;
    if (reconnectConfig.timeoutId) {
      clearTimeout(reconnectConfig.timeoutId);
      reconnectConfig.timeoutId = null;
    }

    // Disconnect existing connection
    if (mqttClient) {
      mqttClient.end();
    }

    let options = {
      port: parseInt(port),
      protocol: useTLS ? 'mqtts' : 'mqtt',
      rejectUnauthorized: false, // For self-signed certificates
      clean: cleanSession !== false, // Default to true if not specified
      brokerAddress: brokerAddress, // Store for reconnection
      connectTimeout: 30 * 1000, // 30 seconds
      reconnectPeriod: 0, // Disable automatic reconnection (we handle it manually)
    };

    // Add username/password if provided
    if (username) {
      options.username = username;
    }
    if (password) {
      options.password = password;
    }

    // Handle AWS IoT certificates
    if (useAwsCerts && useTLS) {
      try {
        const awsCertDir = 'uploads/aws-certificates';
        const caCertPath = path.join(awsCertDir, 'ca-cert.pem');
        const clientCertPath = path.join(awsCertDir, 'client-cert.pem');
        const clientKeyPath = path.join(awsCertDir, 'client-key.pem');

        // Check if all AWS certificates exist
        if (await fs.pathExists(caCertPath) && 
            await fs.pathExists(clientCertPath) && 
            await fs.pathExists(clientKeyPath)) {
          
          const caCert = await fs.readFile(caCertPath);
          const clientCert = await fs.readFile(clientCertPath);
          const clientKey = await fs.readFile(clientKeyPath);

          options.ca = [caCert];
          options.cert = clientCert;
          options.key = clientKey;
          options.rejectUnauthorized = true;
          options.servername = brokerAddress; // SNI support for AWS IoT
        } else {
          return res.status(400).json({ error: 'AWS sertifikaları eksik (ca-cert.pem, client-cert.pem, client-key.pem gerekli)' });
        }
      } catch (error) {
        return res.status(500).json({ error: `AWS certificate reading error: ${error.message}` });
      }
    }
    // Standard certificate handling
    else if (useTLS && certificateFile) {
      const certPath = path.join('uploads/certificates', certificateFile);
      if (await fs.pathExists(certPath)) {
        const cert = await fs.readFile(certPath);
        options.ca = [cert];
        options.rejectUnauthorized = true;
      }
    }

    // Store connection options for reconnection
    reconnectConfig.connectionOptions = options;

    mqttClient = mqtt.connect(`${options.protocol}://${brokerAddress}`, options);

    // Set up event handlers
    setupMqttEventHandlers();

    // Add a timeout for initial connection
    const connectionTimeout = setTimeout(() => {
      if (!connectionStatus.connected && !res.headersSent) {
        res.status(500).json({ error: 'Bağlantı zaman aşımı' });
      }
    }, 30000);

    // Override connect handler for initial connection response
    mqttClient.once('connect', () => {
      clearTimeout(connectionTimeout);
      if (!res.headersSent) {
        res.json({ success: true, message: 'Successfully connected to broker' });
      }
    });

    // Override error handler for initial connection response
    mqttClient.once('error', (error) => {
      clearTimeout(connectionTimeout);
      if (!res.headersSent) {
        res.status(500).json({ error: `Connection error: ${error.message}` });
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Disconnect from MQTT broker
app.post('/api/disconnect', requireAuth, (req, res) => {
  try {
    // Stop reconnection attempts
    reconnectConfig.enabled = false;
    reconnectConfig.currentRetries = 0;
    reconnectConfig.connectionOptions = null;
    
    if (reconnectConfig.timeoutId) {
      clearTimeout(reconnectConfig.timeoutId);
      reconnectConfig.timeoutId = null;
    }

    if (mqttClient) {
      mqttClient.end();
      mqttClient = null;
    }
    
    connectionStatus.connected = false;
    io.emit('connectionStatus', connectionStatus);
          res.json({ success: true, message: 'Connection disconnected' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Subscribe to topic
app.post('/api/subscribe', requireAuth, (req, res) => {
  try {
    const { topic, qos } = req.body;
    
    if (!mqttClient || !connectionStatus.connected) {
      return res.status(400).json({ error: 'Broker\'a bağlı değil' });
    }

    if (!topic) {
      return res.status(400).json({ error: 'Topic gerekli' });
    }

    const subscribeOptions = {
      qos: qos ? parseInt(qos) : 0
    };

    mqttClient.subscribe(topic, subscribeOptions, (error) => {
      if (error) {
        res.status(500).json({ error: `Subscription error: ${error.message}` });
      } else {
                  res.json({ success: true, message: `Subscribed to ${topic} topic with QoS ${subscribeOptions.qos}` });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Publish message
app.post('/api/publish', requireAuth, (req, res) => {
  try {
    const { topic, message, qos, retain } = req.body;
    
    if (!mqttClient || !connectionStatus.connected) {
      return res.status(400).json({ error: 'Broker\'a bağlı değil' });
    }

    if (!topic || message === undefined) {
      return res.status(400).json({ error: 'Topic ve mesaj gerekli' });
    }

    const publishOptions = {
      qos: qos ? parseInt(qos) : 0,
      retain: retain === true
    };

    mqttClient.publish(topic, message, publishOptions, (error) => {
      if (error) {
        res.status(500).json({ error: `Message sending error: ${error.message}` });
      } else {
        res.json({ 
          success: true, 
                      message: `Message sent successfully (QoS: ${publishOptions.qos}, Retain: ${publishOptions.retain})` 
        });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get connection status
app.get('/api/status', requireAuth, (req, res) => {
  res.json(connectionStatus);
});

// Catch-all route for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  // Server started
}); 