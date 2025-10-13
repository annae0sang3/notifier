export interface Env {
  // Cloudflare KV 바인딩 이름: SETTINGS_KV (optional)
  SETTINGS_KV?: KVNamespace;
}

// 메모리 폴백 저장 (Worker 인스턴스 재시작 시 사라짐)
let _inMemorySettings: Record<string, any> | null = null;

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);

    // OPTIONS 프리플라이트 요청 처리
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    if (url.pathname === '/api/duty-list') {
      const dummyData = [
        { name: '김철수', day: '월요일' },
        { name: '박영희', day: '화요일' },
        { name: '이지수', day: '수요일' },
      ];
      return new Response(JSON.stringify(dummyData), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // 설정 저장 엔드포인트 (POST) 및 조회 엔드포인트 (GET)
    if (url.pathname === '/api/settings') {
      if (request.method === 'POST') {
        try {
          const body = await request.json();
          console.log('설정 저장 요청:', body);
          // 우선 Cloudflare KV가 바인딩 되어 있으면 사용
          try {
            if ((env as any).SETTINGS_KV && typeof (env as any).SETTINGS_KV.put === 'function') {
              await (env as any).SETTINGS_KV.put('settings', JSON.stringify(body));
              console.log('Saved settings to KV');
            } else {
              // KV가 없으면 메모리에 저장
              _inMemorySettings = body as any;
              console.log('Saved settings to in-memory fallback');
            }
          } catch (e) {
            console.error('Error saving settings:', e);
          }

          return new Response(JSON.stringify({ success: true }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: String(e) }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      }

      if (request.method === 'GET') {
        try {
          // KV 우선 조회
          if ((env as any).SETTINGS_KV && typeof (env as any).SETTINGS_KV.get === 'function') {
            const value = await (env as any).SETTINGS_KV.get('settings');
            if (value) {
              return new Response(value, { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
            }
          }

          // KV가 없거나 값이 없으면 in-memory 폴백 반환
          if (_inMemorySettings) {
            return new Response(JSON.stringify(_inMemorySettings), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
          }

          return new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: String(e) }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          });
        }
      }
    }

    return new Response('Not Found', { 
      status: 404,
      headers: {
        'Access-Control-Allow-Origin': '*'
      } 
    });
  }
};