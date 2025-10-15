export interface Env {
  // Cloudflare KV 바인딩 이름: SETTINGS_KV (optional)
  SETTINGS_KV?: KVNamespace;
}

// 메모리 폴백 저장 (Worker 인스턴스 재시작 시 사라짐)
let _inMemorySettings: Record<string, any> | null = null;

// 설정 조회 (KV 우선, 메모리 폴백)
async function getSettings(env: Env): Promise<any> {
    try {
        if ((env as any).SETTINGS_KV && typeof (env as any).SETTINGS_KV.get === 'function') {
            const value = await (env as any).SETTINGS_KV.get('settings');
            if (value) {
                return JSON.parse(value);
            }
        }
    } catch (e) {
        console.error('Error reading settings from KV:', e);
    }
    return _inMemorySettings || {};
}

// 설정 저장 (KV 우선, 메모리 폴백)
async function saveSettings(env: Env, body: any): Promise<void> {
    try {
        if ((env as any).SETTINGS_KV && typeof (env as any).SETTINGS_KV.put === 'function') {
            await (env as any).SETTINGS_KV.put('settings', JSON.stringify(body));
            console.log('Saved settings to KV');
        } else {
            _inMemorySettings = body as any;
            console.log('Saved settings to in-memory fallback');
        }
    } catch (e) {
        console.error('Error saving settings:', e);
    }
}

/**
 * 날짜별 당직을 계산하는 핵심 로직 (주 주 야 야 비 비)
 * @param startDate YYYY-MM-DD
 * @param endDate YYYY-MM-DD
 * @param settings 설정 (baseDate, cycle, users)
 */
function calculateDuty(startDate: string, endDate: string, settings: any) {
    const { baseDate, cycle, users } = settings;

    if (!baseDate || !cycle || !users || users.length === 0) {
        return []; // 설정 부족 시 빈 배열 반환
    }

    const dutyCycle = cycle.split(/\s+/).filter(Boolean); // "주 주 야 야 비 비" -> ["주", "주", "야", "야", "비", "비"]
    const baseDateMs = new Date(baseDate).setHours(0, 0, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;

    const schedule = [];
    let currentDateMs = new Date(startDate).setHours(0, 0, 0, 0);
    const endMs = new Date(endDate).setHours(0, 0, 0, 0);

    while (currentDateMs <= endMs) {
        const dateObj = new Date(currentDateMs);
        
        // 1. 기준일 대비 경과 일수 계산
        const daysPassed = Math.round((currentDateMs - baseDateMs) / dayMs);
        
        // 2. 일수와 근무자 수 기반으로 당직 종류(duty) 및 근무자(user) 결정
        const dutyIndex = daysPassed % dutyCycle.length; // 근무 주기 내 인덱스
        const userIndex = daysPassed % users.length; // 근무자 명단 내 인덱스
        
        const dutyType = dutyCycle[dutyIndex];
        const dutyUser = users[userIndex];
        
        // 3. 당직 할당 (간소화된 로직: dutyType에 따라 할당)
        let dayDuty: string[] = [];
        let nightDuty: string[] = [];

        if (dutyType === '주') {
            dayDuty.push(dutyUser);
        } else if (dutyType === '야') {
            // 야간 당직은 2명이라고 가정하고, 다음 근무자를 순환해서 할당
            nightDuty.push(dutyUser);
            nightDuty.push(users[(userIndex + 1) % users.length]);
        }
        // '비'인 경우는 둘 다 빈 배열

        schedule.push({
            date: dateObj.toISOString().split('T')[0], // YYYY-MM-DD 형식
            duty: {
                day: dayDuty,
                night: nightDuty
            }
        });

        currentDateMs += dayMs;
    }

    return schedule;
}


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

        // 1. 스케줄 계산 엔드포인트
        if (url.pathname === '/api/schedule') {
            if (request.method === 'GET') {
                const start = url.searchParams.get('start');
                const end = url.searchParams.get('end');

                if (!start || !end) {
                    return new Response(JSON.stringify({ error: 'Missing start or end date query parameter' }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                    });
                }
                
                // 설정 불러오기
                const settings = await getSettings(env);
                
                // 당직 스케줄 계산
                const schedule = calculateDuty(start, end, settings);
                
                return new Response(JSON.stringify(schedule), {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    }
                });
            }
        }

        // 2. 설정 저장 엔드포인트 (POST) 및 조회 엔드포인트 (GET)
        if (url.pathname === '/api/settings') {
            if (request.method === 'POST') {
                try {
                    const body = await request.json();
                    // 날짜 유효성 검사 등 필요 시 추가 가능

                    await saveSettings(env, body);

                    return new Response(JSON.stringify({ success: true, saved: body }), {
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                    });
                } catch (e) {
                    return new Response(JSON.stringify({ success: false, error: String(e) }), {
                        status: 400,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                    });
                }
            }

            if (request.method === 'GET') {
                try {
                    const settings = await getSettings(env);
                    return new Response(JSON.stringify(settings), { 
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
                    });
                } catch (e) {
                    return new Response(JSON.stringify({ success: false, error: String(e) }), {
                        status: 500,
                        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                    });
                }
            }
        }

        // 3. 기존의 /api/duty-list는 제거
        
        return new Response('Not Found', { 
            status: 404,
            headers: { 'Access-Control-Allow-Origin': '*' } 
        });
    }
};