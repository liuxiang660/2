const APP_NOTIFY_EVENT = 'app:notify';

export function notifyAction(message: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent(APP_NOTIFY_EVENT, {
      detail: { message },
    })
  );
}

export function getNotifyEventName(): string {
  return APP_NOTIFY_EVENT;
}
