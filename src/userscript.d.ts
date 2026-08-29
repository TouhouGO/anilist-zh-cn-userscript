declare const GM_registerMenuCommand: ((name: string, fn: () => void) => void) | undefined;
declare const GM_xmlhttpRequest: ((details: {
  url: string;
  method: string;
  headers?: Record<string, string>;
  data?: string;
  onload: (response: { status: number; responseText: string }) => void;
  onerror: () => void;
}) => void) | undefined;
