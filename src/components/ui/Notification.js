import React, { useState, useEffect } from 'react';
import Icon from './Icon';

const Notification = ({ message, type = 'info', duration = 5000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => onClose && onClose(), 300); // Wait for animation
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose && onClose(), 300);
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return 'check-circle';
      case 'error':
        return 'x-circle';
      case 'warning':
        return 'alert-triangle';
      case 'info':
      default:
        return 'info';
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success':
        return {
          bg: 'bg-white dark:bg-gray-800',
          border: 'border-green-200 dark:border-green-700',
          text: 'text-green-800 dark:text-green-200',
          icon: 'text-green-500 dark:text-green-400',
          iconBg: 'bg-green-50 dark:bg-green-900/30'
        };
      case 'error':
        return {
          bg: 'bg-white dark:bg-gray-800',
          border: 'border-red-200 dark:border-red-700',
          text: 'text-red-800 dark:text-red-200',
          icon: 'text-red-500 dark:text-red-400',
          iconBg: 'bg-red-50 dark:bg-red-900/30'
        };
      case 'warning':
        return {
          bg: 'bg-white dark:bg-gray-800',
          border: 'border-yellow-200 dark:border-yellow-700',
          text: 'text-yellow-800 dark:text-yellow-200',
          icon: 'text-yellow-500 dark:text-yellow-400',
          iconBg: 'bg-yellow-50 dark:bg-yellow-900/30'
        };
      case 'info':
      default:
        return {
          bg: 'bg-white dark:bg-gray-800',
          border: 'border-blue-200 dark:border-blue-700',
          text: 'text-blue-800 dark:text-blue-200',
          icon: 'text-blue-500 dark:text-blue-400',
          iconBg: 'bg-blue-50 dark:bg-blue-900/30'
        };
    }
  };

  const colors = getColors();

  return (
    <div className={`
      fixed top-4 right-4 z-50 max-w-sm w-full
      transform transition-all duration-300 ease-in-out
      ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
    `}>
      <div className={`
        p-4 rounded-lg border shadow-2xl backdrop-blur-sm
        ${colors.bg} ${colors.border}
        ring-1 ring-black/5 dark:ring-white/10
      `}>
        <div className="flex items-start">
          <div className={`flex-shrink-0 p-2 rounded-full ${colors.iconBg}`}>
            <Icon name={getIcon()} size={20} className={colors.icon} />
          </div>
          <div className="ml-3 flex-1 min-w-0">
            <p className={`text-sm font-medium ${colors.text} break-words`}>
              {message}
            </p>
          </div>
          <div className="ml-4 flex-shrink-0">
            <button
              onClick={handleClose}
              className={`
                inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2
                ${colors.text} hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors
              `}
            >
              <Icon name="x" size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Notification; 