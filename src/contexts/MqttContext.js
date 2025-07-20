import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

const MqttContext = createContext();

export const useMqtt = () => {
  const context = useContext(MqttContext);
  if (!context) {
    throw new Error('useMqtt must be used within an MqttProvider');
  }
  return context;
};

export const MqttProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    connected: false,
    brokerAddress: '',
    port: '',
    lastConnected: null,
    error: null
  });
  const [reconnectionStatus, setReconnectionStatus] = useState({
    isReconnecting: false,
    currentRetries: 0,
    maxRetries: 5,
    lastFailure: null
  });
  const [messages, setMessages] = useState([]);
  const [subscribedTopics, setSubscribedTopics] = useState(new Set());

  // Initialize Socket.IO connection
  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('connectionStatus', (status) => {
      setConnectionStatus(status);
      
      // Reset reconnection status if successfully connected
      if (status.connected) {
        setReconnectionStatus({
          isReconnecting: false,
          currentRetries: 0,
          maxRetries: 5,
          lastFailure: null
        });
      }
      
      // Update reconnection status if error contains retry information
      if (status.error && status.error.includes('Yeniden bağlanma denemesi')) {
        const match = status.error.match(/(\d+)\/(\d+)/);
        if (match) {
          setReconnectionStatus(prev => ({
            ...prev,
            isReconnecting: true,
            currentRetries: parseInt(match[1]),
            maxRetries: parseInt(match[2])
          }));
        }
      }
    });

    newSocket.on('reconnectionFailed', (data) => {
      setReconnectionStatus({
        isReconnecting: false,
        currentRetries: data.retries,
        maxRetries: data.maxRetries,
        lastFailure: new Date().toISOString()
      });
      
      // Show browser notification if supported
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('MQTT Bağlantı Hatası', {
          body: data.message,
          icon: '/favicon.ico'
        });
      }
    });

    newSocket.on('mqttMessage', (data) => {
      const newMessage = {
        ...data,
        id: Date.now() + Math.random(),
        timestamp: new Date()
      };
      setMessages(prev => [newMessage, ...prev.slice(0, 99)]); // Keep last 100 messages
    });

    newSocket.on('subscriptionConfirmed', (topic) => {
      setSubscribedTopics(prev => new Set([...prev, topic]));
    });

    newSocket.on('subscriptionError', (error) => {
      // Removed console.error for production
    });

    return () => {
      newSocket.close();
    };
  }, []);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const connectToMqtt = useCallback(async (connectionParams) => {
    if (!socket) return;

    try {
      const response = await fetch('/api/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(connectionParams),
      });

      const result = await response.json();
      
      if (response.ok) {
        return { success: true, message: result.message };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [socket]);

  const disconnectFromMqtt = useCallback(async () => {
    if (!socket) return;

    try {
      const response = await fetch('/api/disconnect', {
        method: 'POST',
      });

      const result = await response.json();
      
      if (response.ok) {
        setSubscribedTopics(new Set());
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, [socket]);

  const subscribeToTopic = useCallback((topic, qos = 0) => {
    if (!socket || !connectionStatus.connected) return;

    socket.emit('subscribe', { topic, qos });
  }, [socket, connectionStatus.connected]);

  const unsubscribeFromTopic = useCallback((topic) => {
    if (!socket || !connectionStatus.connected) {
      return;
    }

    socket.emit('unsubscribe', { topic });
    
    // Remove from subscribed topics immediately
    setSubscribedTopics(prev => {
      const newSet = new Set(prev);
      newSet.delete(topic);
      return newSet;
    });
    
    // Emit additional cleanup event if needed
    socket.emit('cleanup-topic', { topic });
    
  }, [socket, connectionStatus.connected]);

  const publishMessage = useCallback((topic, message, qos = 0) => {
    if (!socket || !connectionStatus.connected) return;

    // Add _send suffix to topics when publishing from UI to devices
    const sendTopic = topic.endsWith('_send') ? topic : `${topic}_send`;
    
    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    socket.emit('publish', { topic: sendTopic, message: payload, qos });
  }, [socket, connectionStatus.connected]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const value = {
    isConnected,
    connectionStatus,
    reconnectionStatus,
    messages,
    subscribedTopics: Array.from(subscribedTopics),
    connectToMqtt,
    disconnectFromMqtt,
    subscribeToTopic,
    unsubscribeFromTopic,
    publishMessage,
    clearMessages,
  };

  return (
    <MqttContext.Provider value={value}>
      {children}
    </MqttContext.Provider>
  );
}; 