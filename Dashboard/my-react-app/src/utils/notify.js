const detectNotificationType = (message) => {
  const text = String(message || '').toLowerCase();
  if (!text) {
    return 'info';
  }
  if (/(error|failed|unable|cannot|insufficient|invalid|select|enter|empty|missing|denied|not reach)/i.test(text)) {
    return 'danger';
  }
  if (/(saved|success|added|updated|created|generated|removed|placed|refunded|paid|complete|activated)/i.test(text)) {
    return 'success';
  }
  return 'info';
};

export const notify = (message, type, timeout = 5000) => {
  if (!message) {
    return;
  }

  window.dispatchEvent(new CustomEvent('app:notify', {
    detail: {
      message,
      type: type || detectNotificationType(message),
      timeout,
    },
  }));
};
