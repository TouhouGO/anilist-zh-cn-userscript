export type JsonRequestInit = {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
};

export type JsonRequester = (url: string, init?: JsonRequestInit) => Promise<unknown>;

export function requestJson(url: string, init: JsonRequestInit = {}): Promise<unknown> {
  if (typeof GM_xmlhttpRequest === 'function') {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        url,
        method: init.method || 'GET',
        headers: init.headers,
        data: init.body,
        onload: response => {
          if (response.status < 200 || response.status >= 300) {
            reject(new Error(`request failed: ${response.status}`));
            return;
          }
          try { resolve(JSON.parse(response.responseText)); }
          catch { reject(new Error('request returned invalid JSON')); }
        },
        onerror: () => reject(new Error('request failed')),
      });
    });
  }

  return fetch(url, {
    method: init.method || 'GET',
    headers: init.headers,
    body: init.body,
  }).then(async response => {
    if (!response.ok) throw new Error(`request failed: ${response.status}`);
    return response.json();
  });
}
