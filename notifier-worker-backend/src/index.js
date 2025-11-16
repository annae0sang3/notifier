// Cloudflare KV 바인딩 이름: SETTINGS_KV
// GROUP_CHAT_ID  미니앱 접근 제어 대상 그룹 (이 그룹 멤버만 사용 가능)  ->  GROUP_CHAT_ID_TO_ENFORCE
// CHAT_ID  봇이 주기적 메시지를 보낼 대상 그룹/채팅방  (스케줄러 동작 시 필수)  ->ELEGRAM_BOT_DEFAULT_CHAT_ID

// let _inMemorySettings = null;
const DEFAULT_USERS = ['1st', '2nd', '3rd', '4th'];

function parseDateYMD(s) {  // 📅 헬퍼: YYYY-MM-DD 형식의 문자열을 UTC Date 객체로 변환
 const [y, m, d] = s.split('-').map(Number);
 return new Date(Date.UTC(y, m - 1, d));
}

function formatYMD(d) {   // 📝 헬퍼: UTC Date 객체를 YYYY-MM-DD 형식의 문자열로 변환
 const yyyy = d.getUTCFullYear();
 const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
 const dd = String(d.getUTCDate()).padStart(2, '0');
 return `${yyyy}-${mm}-${dd}`;
}

function daysBetweenUTC(a, b) {     // 🗓️ 헬퍼: 두 UTC Date 객체 간의 일수 차이 계산
 const msPerDay = 24 * 60 * 60 * 1000;
 return Math.floor((a.getTime() - b.getTime()) / msPerDay);
}

function wrapPointer(pointer, length) {   // 🔄 헬퍼: 배열 포인터를 길이 내에서 순환하도록 조정
 return ((pointer % length) + length) % length;
}

function convertUTCtoKST(utcDate) {     // ✅ UTC → KST 변환 헬퍼
 return new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
}

async function sendTelegramMessage(env, message, chatId, buttons = null) {    // ✅ 텔레그램 메시지 전송 헬퍼 
 const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`;
 const headers = { 'Content-Type': 'application/json' };
 const body = {
   chat_id: chatId,
   text: message,
   parse_mode: 'Markdown',
 };
 if (buttons) {
   body.reply_markup = { // 💥 buttons 배열을 { "inline_keyboard": buttons } 형태로 감싸서 보냄
     inline_keyboard: buttons
   };
 }
 try {
   const response = await fetch(url, {
     method: 'POST',
     headers: headers,
     body: JSON.stringify(body),
   });
   if (!response.ok) {
     const errorData = await response.json().catch(() => ({}));
     console.error('Failed to send Telegram message:', errorData);
     throw new Error(`Telegram API error: ${JSON.stringify(errorData)}`);
   }
 } catch (e) {
   console.error('Error sending Telegram message:', e);
 }
}

// ✅ 텔레그램 콜백 쿼리 응답 헬퍼
async function answerCallbackQuery(env, callbackQueryId, text, showAlert = false) {
 const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`;
 const headers = { 'Content-Type': 'application/json' };
 const body = {
   callback_query_id: callbackQueryId,
   text: text,
   show_alert: showAlert
 };
 try {
   const response = await fetch(url, {
     method: 'POST',
     headers: headers,
     body: JSON.stringify(body),
   });
   if (!response.ok) {
     const errorData = await response.json().catch(() => ({}));
     console.error('Failed to answer callback query:', errorData);
   }
 } catch (e) {
   console.error('Error answering callback query:', e);
 }
}

async function editMessageReplyMarkup(env, chatId, messageId, inlineKeyboard) {   // Helper: 메시지 인라인 키보드 수정
 const url = `https://api.telegram.org/bot${env.BOT_TOKEN}/editMessageReplyMarkup`;
 const headers = { 'Content-Type': 'application/json' };
 const body = {
     chat_id: chatId,
     message_id: messageId,
     reply_markup: {
         inline_keyboard: inlineKeyboard
     }
 };
 try {
     const response = await fetch(url, {
         method: 'POST',
         headers: headers,
         body: JSON.stringify(body),
     });
     if (!response.ok) {
         const errorData = await response.json();
         console.error('Failed to edit message reply markup:', errorData);
         throw new Error(`Telegram API error: ${JSON.stringify(errorData)}`);
     }
 } catch (e) {
     console.error('Error editing message reply markup:', e);
 }
}

async function generateSignature(userId, chatId, botToken) {    // Helper: URL 파라미터 서명 생성 (user_id, chat_id 위변조 방지)
 const dataToSign = `${userId}:${chatId}`;    // 서명할 데이터는 userId와 chatId를 콜론으로 연결한 문자열
 const secretKey = await crypto.subtle.digest(  // 봇 토큰으로 HMAC 시크릿 키 생성
     'SHA-256',
     new TextEncoder().encode(botToken)
 );
 const key = await crypto.subtle.importKey(
     'raw',
     secretKey,
     { name: 'HMAC', hash: 'SHA-256' },
     false,
     ['sign']
 );
 const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(dataToSign));  // 데이터 서명
 return Array.from(new Uint8Array(signatureBuffer))  // 서명 결과(ArrayBuffer)를 16진수 문자열로 변환
     .map((b) => b.toString(16).padStart(2, '0'))
     .join('');
}

async function getDutyInfoFromSettingsKV(targetDate, env) {   // 💥 SETTINGS_KV 사용하여 당직 정보 계산
 let settings = null;
 let dayDutyRoster = null;
 let night2DutyRoster = null;

 try {
   const settingsJson = await env.SETTINGS_KV.get("settings");
   if (settingsJson) {
     settings = JSON.parse(settingsJson);
   }
   const dayDutyRosterJson = await env.SETTINGS_KV.get("dayDutyRoster");
   if (dayDutyRosterJson) {
     dayDutyRoster = JSON.parse(dayDutyRosterJson);
   }
   const night2DutyRosterJson = await env.SETTINGS_KV.get("night2DutyRoster");
   if (night2DutyRosterJson) {
     night2DutyRoster = JSON.parse(night2DutyRosterJson);
   }
 } catch (e) {
   console.error("KV settings load error in getDutyInfoFromSettingsKV:", e);
   return {
     message: "설정 정보를 불러오는 데 실패했습니다. 관리자에게 문의하세요.",
     dutyType: "에러"
   };
 } 

 if (!settings || typeof settings.cycle !== 'string' || settings.cycle.trim() === '' ||   // 🚨 설정이 유효하지 않을 때 강제 기본값 적용
     !Array.isArray(settings.users) || settings.users.length === 0) {
   console.warn("Using fallback settings for scheduled task due to missing or invalid KV data.");
   settings = {
     cycle: '주 주 야 야 비 비',
     baseDate: formatYMD(convertUTCtoKST(new Date())),
     users: DEFAULT_USERS
   };
 }

 const cycleTokens = (settings.cycle || '').trim().split(/\s+/).filter(Boolean);
 const baseDateStr = settings.baseDate;
 const users = settings.users;
 // const numPeople = users.length; 

//  if (!Array.isArray(dayDutyRoster) || dayDutyRoster.length === 0) {  // 👷‍♂️ dayDutyRoster가 유효하지 않으면 users를 기반으로 기본 로스터 생성 (임시)
//    if (numPeople % 2 === 0) {
//      const secondHalf = [];
//      for (let i = 0; i < numPeople; i += 2) {
//        secondHalf.push(users[i + 1], users[i]);
//      }
//      dayDutyRoster = [...users, ...secondHalf];
//    } else {
//      dayDutyRoster = Array.from({ length: numPeople * 2 }, (_, i) => users[i % numPeople]);
//    }
//    console.warn("Using fallback dayDutyRoster in getDutyInfoFromSettingsKV.");
//  }

//  if (!Array.isArray(night2DutyRoster) || night2DutyRoster.length === 0) {   // 🌙 night2DutyRoster가 유효하지 않으면 dayDutyRoster를 기반으로 생성 (임시)
//    if (Array.isArray(dayDutyRoster) && dayDutyRoster.length >= 2) {
//      night2DutyRoster = [...dayDutyRoster.slice(2), ...dayDutyRoster.slice(0, 2)];
//    } else {
//      night2DutyRoster = Array.from({ length: users.length * 2 }, (_, i) => users[(i + 2) % users.length]);
//    }
//    console.warn("Using fallback night2DutyRoster in getDutyInfoFromSettingsKV.");
//  }

 const night1DutyRoster = [...dayDutyRoster]; // nightDuty1은 dayDutyRoster와 동일 개념
 const dayDutyRosterLen = dayDutyRoster.length;
 const night1DutyRosterLen = night1DutyRoster.length;
 const night2DutyRosterLen = night2DutyRoster.length;

 // 🗓️ 로직 계산 
// 1. 기준일과 대상일의 UTC Date 객체 생성
const baseDateUTC = parseDateYMD(baseDateStr); // Base date (UTC)
 
// targetDate는 KST 자정(00시) 객체임. 이 날짜의 YYYY-MM-DD 문자열을 사용해야 함.
const targetDateYMD_KST = formatYMD(targetDate); // Get the KST date string (e.g., "2025-11-12")
const targetDateUTC = parseDateYMD(targetDateYMD_KST); // Get the UTC date object for that KST date

// 2. 날짜 차이 및 사이클 인덱스 계산
const diffDays = daysBetweenUTC(targetDateUTC, baseDateUTC);
const cycleIndex = wrapPointer(diffDays, cycleTokens.length);
const dutyTypeRaw = cycleTokens[cycleIndex];

// 3. 💥💥💥 'handleSchedule'의 포인터 계산 로직 적용 (핵심 수정)
// diffDays 만큼의 '주', '야' 횟수를 누적하여 시작 포인터를 계산
let dayCountPointer = 0;
let nightCountPointer = 0;

if (diffDays !== 0) {
  let totalDayMoves = 0;
  let totalNightMoves = 0;
  // diffDays가 양수면 base -> target, 음수면 target -> base
  const loopStart = diffDays > 0 ? baseDateUTC : targetDateUTC;
  const loopEnd = diffDays > 0 ? targetDateUTC : baseDateUTC;

  for (let d = new Date(loopStart.getTime()); d.getTime() < loopEnd.getTime(); d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
    const offsetFromBase = daysBetweenUTC(d, baseDateUTC);
    const cidx = wrapPointer(offsetFromBase, cycleTokens.length);
    const token = cycleTokens[cidx];

    if (diffDays < 0) { // Target is before base, we are rewinding (pointer를 뒤로)
      if (token.includes('주')) totalDayMoves--;
      else if (token.includes('야')) totalNightMoves--;
    } else { // Target is after base, we are fast-forwarding (pointer를 앞으로)
      if (token.includes('주')) totalDayMoves++;
      else if (token.includes('야')) totalNightMoves++;
    }
  }
  dayCountPointer = wrapPointer(totalDayMoves, dayDutyRosterLen);
  nightCountPointer = wrapPointer(totalNightMoves, night1DutyRosterLen); // night2는 night1과 동일한 오프셋 사용
}
// --- 포인터 계산 로직 종료 ---

const weekday = new Intl.DateTimeFormat('ko-KR', { weekday: 'short' }).format(targetDate);
const formattedDate = `${targetDate.getFullYear().toString().slice(2)}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')} (${String(weekday)})`;

let dutyMessage = "";
let dutyType = "";

if (dutyTypeRaw.includes('주')) {
  dutyType = '주간';
  if (dayDutyRoster.length === 0) { // KV에서 로스터를 못 읽어온 경우
    dutyMessage = `주간 당직표가 설정되지 않았어요. 설정 페이지에서 설정해주세요!`;
  } else {
    // ✅ 수정된 포인터 사용 (더 이상 % 연산 불필요)
    const name = dayDutyRoster[dayCountPointer]; 
    if (!name || users.includes(name) === false) {
      dutyMessage = `오늘 ${formattedDate} 주간 당직자 (이름: ${name}) 매칭 실패! 설정 페이지를 확인해주세요.`;
    } else {
      dutyMessage = `📅 ${formattedDate} ☀️ 주간 당직 \n🏃‍♂️ ${name}`;
    }
  }
} else if (dutyTypeRaw.includes('야')) {
  dutyType = '야간';
  if (night1DutyRoster.length === 0 || night2DutyRoster.length === 0) { // KV에서 로스터를 못 읽어온 경우
    dutyMessage = `야간 당직표가 설정되지 않았어요. 설정 페이지에서 설정해주세요!`;
  } else {
    // ✅ 수정된 포인터 사용 (더 이상 % 연산 불필요)
    const name1 = night1DutyRoster[nightCountPointer];
    const name2 = night2DutyRoster[nightCountPointer];
    if (!name1 || !name2 || users.includes(name1) === false || users.includes(name2) === false) {
      dutyMessage = `오늘 ${formattedDate} 야간 당직자 (이름: ${name1} ${name2}) 매칭 실패! 설정 페이지를 확인해주세요.`;
    } else {
      dutyMessage = `📅 ${formattedDate} 🌙 야간 당직 \n🏃‍♂️ ${name1}, ${name2}`;
    }
  }
} else {
  dutyType = '비번';
  dutyMessage = `📅 ${formattedDate} 😴 비번`;
}
return { message: dutyMessage, dutyType: dutyType };
}

async function handleSettings(request, env) {   // ⚙️ 설정 GET/POST 핸들러 (기존 index.js 로직 그대로)
 if (request.method === 'POST') {
   try {
     const data = await request.json();
     const { cycle, baseDate, users } = data;
     if (!users || users.length === 0) {
       return new Response('근무자 명단이 필요합니다.', {
         status: 400,
         headers: { 'Access-Control-Allow-Origin': '*' }
       });
     }
     const numPeople = users.length;
     let dayDutyRoster;
     if (numPeople % 2 === 0) {
       const secondHalf = [];
       for (let i = 0; i < numPeople; i += 2) {
         secondHalf.push(users[i + 1], users[i]);
       }
       dayDutyRoster = [...users, ...secondHalf];
     } else {
       dayDutyRoster = Array.from({ length: numPeople * 2 }, (_, i) => users[i % numPeople]);
     }
     const night2DutyRoster = [...dayDutyRoster.slice(2), ...dayDutyRoster.slice(0, 2)];
     const settings = { cycle, baseDate, users };
     await env.SETTINGS_KV.put("settings", JSON.stringify(settings));
     await env.SETTINGS_KV.put("dayDutyRoster", JSON.stringify(dayDutyRoster));
     await env.SETTINGS_KV.put("night2DutyRoster", JSON.stringify(night2DutyRoster));

    //  _inMemorySettings = settings;

     return new Response(JSON.stringify({ ok: true }), {
       status: 200,
       headers: {
         'Content-Type': 'application/json',
         'Access-Control-Allow-Origin': '*'
       }
     });
   } catch (err) {
     console.error("Settings POST error:", err);
     return new Response(
       JSON.stringify({ ok: false, error: String(err) }),
       { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
     );
   }
 } else if (request.method === 'GET') {
   try {
     if (env.SETTINGS_KV && typeof env.SETTINGS_KV.get === 'function') {
       const value = await env.SETTINGS_KV.get('settings');
       if (value) {
         return new Response(value, { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
       }
     }
    //  if (_inMemorySettings) {
    //    return new Response(JSON.stringify(_inMemorySettings), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    //  }
     return new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
   } catch (e) {
     console.error("Settings GET error:", e);
     return new Response(
       JSON.stringify({ success: false, error: String(e) }),
       {
         status: 500,
         headers: {
           'Content-Type': 'application/json',
           'Access-Control-Allow-Origin': '*'
         }
       }
     );
   }
 }
 return new Response('Method Not Allowed', {
   status: 405,
   headers: { 'Access-Control-Allow-Origin': '*' }
 });
}

async function handleSchedule(request, env) {   // 🗓️ 근무 스케줄 생성 API 핸들러
 const url = new URL(request.url);
 try {
   const start = url.searchParams.get('start');
   const end = url.searchParams.get('end');
   if (!start || !end) {
     return new Response(JSON.stringify({ error: 'start/end required' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
   }

   let settings = null;   // ✅ SETTINGS_KV에서 설정 및 로스터 로드
   let dayDutyRoster = null;
   let night2DutyRoster = null;
   try {
     const settingsJson = await env.SETTINGS_KV.get("settings");
     if (settingsJson) {
       settings = JSON.parse(settingsJson);
     }
     const dayDutyRosterJson = await env.SETTINGS_KV.get("dayDutyRoster");
     if (dayDutyRosterJson) {
       dayDutyRoster = JSON.parse(dayDutyRosterJson);
     }
     const night2DutyRosterJson = await env.SETTINGS_KV.get("night2DutyRoster");
     if (night2DutyRosterJson) {
       night2DutyRoster = JSON.parse(night2DutyRosterJson);
     }
   } catch (e) {
     console.error("KV settings load error in handleSchedule:", e);
     // 에러 발생 시에도 아래에서 settings 등이 null이므로 fallback 처리됨
   }

   if (!settings ||   // 🚨 설정이 유효하지 않을 때 강제 기본값 적용
     typeof settings.cycle !== 'string' ||
     settings.cycle.trim() === '' ||
     !Array.isArray(settings.users) ||
     settings.users.length === 0
   ) {
     console.warn("Using fallback settings due to missing or invalid KV data in handleSchedule.");
     settings = {
       cycle: '주 주 야 야 비 비',
       baseDate: start,
       users: DEFAULT_USERS
     };
   }
    // ✅ [수정] KV에서 로스터를 불러오지 못했거나 비어있는 경우, Mini App에 오류 반환
    if (!Array.isArray(dayDutyRoster) || dayDutyRoster.length === 0 ||
    !Array.isArray(night2DutyRoster) || night2DutyRoster.length === 0) {

        // 단, settings도 없어서 fallback을 타는 경우는 (DEFAULT_USERS)
        // 임시 로스터를 생성하여 반환 (최초 설정 화면 진입 등)
        if (settings.users === DEFAULT_USERS) {
            console.warn("Generating temporary fallback roster for handleSchedule.");
            const numPeople = settings.users.length;
            if (numPeople % 2 === 0) {
                const secondHalf = [];
                for (let i = 0; i < numPeople; i += 2) {
                  secondHalf.push(settings.users[i + 1], settings.users[i]);
                }
                dayDutyRoster = [...settings.users, ...secondHalf];
            } else {
                dayDutyRoster = Array.from({ length: numPeople * 2 }, (_, i) => settings.users[i % numPeople]);
            }
            night2DutyRoster = [...dayDutyRoster.slice(2), ...dayDutyRoster.slice(0, 2)];
        } else {
            // 설정(settings)은 있는데 로스터만 없는 경우 = 설정 저장 시 문제
            console.error("Settings exist but rosters are missing in KV for handleSchedule.");
            return new Response(JSON.stringify({ error: '당직 로스터 정보가 없습니다. 관리자 페이지에서 설정을 다시 저장해주세요.' }), { 
                status: 400, // Bad Request
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } 
            });
        }
    }

    const cycleTokens = (typeof settings.cycle === 'string' ? settings.cycle : '').trim().split(/\s+/).filter(Boolean);
    const baseDate = settings.baseDate || start;
    const users = settings.users; // users는 settings에서 가져옴

    const night1DutyRoster = [...dayDutyRoster];

   const startDate = parseDateYMD(start);
   const endDate = parseDateYMD(end);
   if (endDate < startDate) {
     return new Response(JSON.stringify({ error: 'end must be >= start' }), { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
   }

   const schedule = [];
   const cycleLen = cycleTokens.length || 1;
   let dayDutyRosterPointer = 0;
   let night1DutyRosterPointer = 0;
   let night2DutyRosterPointer = 0;
   const base = parseDateYMD(baseDate);
   const dayDutyRosterLen = dayDutyRoster.length;
   const night1DutyRosterLen = night1DutyRoster.length;
   const night2DutyRosterLen = night2DutyRoster.length;
   const dayDifference = daysBetweenUTC(startDate, base);

   if (dayDifference !== 0) {
     let totalDayMoves = 0;
     let totalNightMoves = 0;
     const loopStart = dayDifference > 0 ? base : startDate;
     const loopEnd = dayDifference > 0 ? startDate : base;

     for (let d = new Date(loopStart.getTime()); d.getTime() < loopEnd.getTime(); d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
       const offsetFromBase = daysBetweenUTC(d, base);
       const cidx = wrapPointer(offsetFromBase, cycleTokens.length);
       const token = cycleTokens[cidx];

       if (dayDifference < 0) {
         if (token.includes('주')) {
           totalDayMoves--;
         } else if (token.includes('야')) {
           totalNightMoves--;
         }
       } else {
         if (token.includes('주')) {
           totalDayMoves++;
         } else if (token.includes('야')) {
           totalNightMoves++;
         }
       }
     }
     dayDutyRosterPointer = wrapPointer(totalDayMoves, dayDutyRosterLen);
     night1DutyRosterPointer = wrapPointer(totalNightMoves, night1DutyRosterLen);
     night2DutyRosterPointer = wrapPointer(totalNightMoves, night2DutyRosterLen);
   }
   for (let d = new Date(startDate.getTime()); d.getTime() <= endDate.getTime(); d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
     const currentDateStr = formatYMD(d);
     const offsetFromBase = daysBetweenUTC(d, base);
     const cycleIndex = wrapPointer(offsetFromBase, cycleTokens.length);
     const token = cycleTokens[cycleIndex];
     let dayWorker = null;
     let night1Worker = null;
     let night2Worker = null;
     if (token.includes('주')) {
       dayWorker = dayDutyRoster[dayDutyRosterPointer];
       dayDutyRosterPointer = wrapPointer(dayDutyRosterPointer + 1, dayDutyRosterLen);
     }
     if (token.includes('야')) {
       night1Worker = night1DutyRoster[night1DutyRosterPointer];
       night1DutyRosterPointer = wrapPointer(night1DutyRosterPointer + 1, night1DutyRosterLen);
       night2Worker = night2DutyRoster[night2DutyRosterPointer];
       night2DutyRosterPointer = wrapPointer(night2DutyRosterPointer + 1, night2DutyRosterLen);
     }
     const entry = {
       date: currentDateStr,
       day: token.includes('주') ? dayWorker : null,
       night1: token.includes('야') ? night1Worker : null,
       night2: token.includes('야') ? night2Worker : null,
       type: token
     };
     schedule.push(entry);
   }
   return new Response(JSON.stringify(schedule), {
     headers: {
       'Content-Type': 'application/json',
       'Access-Control-Allow-Origin': '*'
     }
   });
 } catch (e) {
   console.error("Schedule generation error in handleSchedule:", e);
   return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
 }
}

async function handleRootManualFetch(env) {   // /api/schedule와 유사하게 작동하지만, 오늘 날짜의 당직 정보 문자열을 반환
 const nowKST = convertUTCtoKST(new Date());
 const targetDate = new Date(nowKST);
 targetDate.setHours(0, 0, 0, 0);
 const dutyInfo = await getDutyInfoFromSettingsKV(targetDate, env);
 console.log("Manual Fetch Trigger (KST):", nowKST.toISOString());
 console.log("Manual Message:", dutyInfo.message);
 return new Response(dutyInfo.message, {
   headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
 });
}

async function handleVerifyParams(request, env, GROUP_CHAT_ID_ENV_VAR) {    // 💥💥💥 URL 파라미터 기반 검증 엔드포인트 💥💥💥
 let rawBody = null; // 요청 본문의 Raw 데이터를 저장할 변수
 let bodyJson = null; // Raw 데이터를 JSON으로 파싱한 결과
 try {
     // 1. 요청 본문을 텍스트로 읽어 로깅
     // request.text()를 호출하면 body 스트림이 소모되므로, 이후 request.json()을 직접 호출할 수 없음.
     // 대신 JSON.parse()를 사용하여 수동으로 파싱.
     rawBody = await request.text();
     console.log("DEBUG_WORKER_RECEIVED_RAW_BODY:", rawBody); // Workers에 들어온 실제 Raw Body 로그
     // 2. Raw Body를 JSON 객체로 파싱 시도
     bodyJson = JSON.parse(rawBody);
 } catch (e) {
     console.error("Verification error - Failed to parse request body as JSON:", e);
     console.error("Received raw body that caused parsing error:", rawBody); // 파싱 실패한 raw body도 로깅
     return new Response(JSON.stringify({ ok: false, reason: 'Invalid request body format (expected JSON).' }), {
         status: 400, // Bad Request
         headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
     });
 }
 const { userId, chatId, signature } = bodyJson; // 파싱된 JSON에서 필요한 값 추출

 if (!userId || !chatId || !signature) {   // 3. 필수 파라미터 누락 확인
     console.error("Verification error - Missing required parameters in JSON body:", { userId, chatId, signature });
     return new Response(JSON.stringify({ ok: false, reason: 'Missing userId, chatId or signature in request body.' }), {
         status: 400, // Bad Request
         headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
     });
 }
 try {
     const expectedSignature = await generateSignature(userId, chatId, env.BOT_TOKEN);     // 4. ✨ 보안 강화: 시그니처 재검증
     if (expectedSignature !== signature) {
         console.warn(`Verification error - Invalid signature for userId=${userId}, chatId=${chatId}. Expected: ${expectedSignature}, Got: ${signature}`);
         return new Response(JSON.stringify({ ok: false, reason: 'Invalid signature.' }), {
             status: 403, // 접근 금지: 위변조 의심
             headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
         });
     }
     // 5. 그룹 멤버십 확인 (GROUP_CHAT_ID_ENV_VAR 환경 변수가 설정된 경우)
     // GROUP_CHAT_ID_ENV_VAR는 Workers 환경 변수로 설정된 '접근 허용 그룹 ID
     if (GROUP_CHAT_ID_ENV_VAR) { // 환경 변수가 설정된 경우에만 멤버십 검증 진행
         if (String(chatId) !== String(GROUP_CHAT_ID_ENV_VAR)) { // 문자열 비교를 위해 String()으로 형변환
             console.warn(`Verification error - Mini App launched from non-allowed chat. Expected chat_id: ${GROUP_CHAT_ID_ENV_VAR}, Got: ${chatId}`);
             return new Response(
                 JSON.stringify({ ok: false, reason: 'This Mini App can only be launched from a specific group chat.' }),
                 {
                     status: 403, // 접근 금지
                     headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                 }
             );
         }
         const tgResp = await fetch(
             `https://api.telegram.org/bot${env.BOT_TOKEN}/getChatMember?chat_id=${GROUP_CHAT_ID_ENV_VAR}&user_id=${userId}`
         );         // 해당 그룹의 멤버인지 텔레그램 API를 통해 확인
         const tgData = await tgResp.json();
         if (!tgData.ok || ['left', 'kicked'].includes(tgData.result.status)) {
             console.warn(`Verification error - User ${userId} is not a member of the allowed group ${GROUP_CHAT_ID_ENV_VAR}. Status: ${tgData.result ? tgData.result.status : 'API error'}`);
             return new Response(
                 JSON.stringify({ ok: false, reason: 'You are not a member of the allowed group.' }),
                 {
                     status: 403, // 접근 금지
                     headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                 }
             );
         }  

         const userFirstName = (tgData.result.user && tgData.result.user.first_name) 
                               ? tgData.result.user.first_name 
                               : `User ${userId}`;
         const user = { id: userId, status: tgData.result.status, first_name: userFirstName };

         return new Response(
             JSON.stringify({ ok: true, user: user, chat_id: chatId }),
             { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
         );
     } else {     // GROUP_CHAT_ID_ENV_VAR 환경 변수가 설정되지 않은 경우    
         console.log("Group chat membership not enforced (GROUP_CHAT_ID not set in Workers env). Allowing access.");
         return new Response(
             JSON.stringify({ ok: true, user: { id: userId, first_name: `User ${userId}` }, chat_id: chatId, message: 'Group chat membership not enforced (GROUP_CHAT_ID not set).' }),
             { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
         );
     }
 } catch (err) {
     console.error("Verification error - Unhandled exception:", err);
     return new Response(
         JSON.stringify({ ok: false, error: String(err) }),
         { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
     );
 }
}








export default {

 async fetch(request, env, ctx) {  // 🚀 API 요청 처리
   const url = new URL(request.url);
   const GROUP_CHAT_ID_TO_ENFORCE = env.GROUP_CHAT_ID ? String(env.GROUP_CHAT_ID) : null;
   const TELEGRAM_BOT_DEFAULT_CHAT_ID = env.CHAT_ID;
   if (request.method === 'OPTIONS') {   // ⚙️ 💥💥💥 가장 먼저 OPTIONS 프리플라이트 요청 처리 (CORS) 💥💥💥
       return new Response(null, {
           status: 204, // No Content 상태 코드로 응답 (성공적인 프리플라이트 응답)
           headers: {
               'Access-Control-Allow-Origin': '*', // 모든 오리진 허용
               'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', // 허용할 메서드
               'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Chat-Id',// 허용할 헤더
               'Access-Control-Max-Age': '86400' // 프리플라이트 응답 캐시 시간 (초)
           }
       });
   }
    // ➤ 핵심 추가: 텔레그램 미니앱 호출 시 URL에 chat_id 또는 user_id가 포함되어 있으면
    //     파라미터 제거 후 클린 URL로 302 리다이렉트 처리
    if (url.searchParams.has('chat_id') || url.searchParams.has('user_id')) {
      url.search = ''; // 쿼리 스트링 제거
      return Response.redirect(url.toString(), 302);
    }
   // 💥💥💥 텔레그램 봇 관련 POST 요청 처리 💥💥💥
   // 이 블록은 텔레그램 웹훅에서 들어오는 업데이트 (callback_query 등)를 처리합니다.
   if (request.method === 'POST' && url.pathname === '/') { // 텔레그램 웹훅은 보통 루트 경로로 POST 요청을 보냄
     const update = await request.json(); // 웹훅 요청은 body에 업데이트 객체가 포함됨
     if (update.callback_query) {
       const callbackQuery = update.callback_query;
       const data = callbackQuery.data;
       const callbackQueryId = callbackQuery.id;
       const messageChatId = callbackQuery.message.chat.id;
       const userId = callbackQuery.from.id;
       const messageId = callbackQuery.message.message_id;
       console.log(`Callback query received: ${data}`);
       switch (data) {
         case 'request_mini_app_access':
           await answerCallbackQuery(env, callbackQueryId, '미니앱을 준비 중입니다...');
           const miniAppBaseUrl = 'https://notifier-pages-frontend.pages.dev/';
           const signature = await generateSignature(userId, messageChatId, env.BOT_TOKEN);
           const parameterizedMiniAppUrl = `${miniAppBaseUrl}?user_id=${userId}&chat_id=${messageChatId}&sig=${signature}`;
           await editMessageReplyMarkup(env, messageChatId, messageId, [[
               { text: '🗓️👷‍♂️ |월간| 당직 일정 🔓열기 💥🚀', url: parameterizedMiniAppUrl }
           ]]);
           break;
         default:
           console.log(`Unknown callback data: ${data}`);
           await answerCallbackQuery(env, callbackQueryId, '알 수 없는 요청입니다.', true);
           break;
       }
       return new Response("OK", { status: 200 });
     }
     return new Response("OK", { status: 200 });
   }
  
   // 🚀 REST API 라우팅 (GET/POST 요청 처리)
   if (url.pathname === '/verify_params' && request.method === 'POST') {   // 💥💥💥 /verify_params는 반드시 POST 메서드로만 처리! 💥💥💥
       return handleVerifyParams(request, env, GROUP_CHAT_ID_TO_ENFORCE);
   }
   else if (url.pathname === '/api/settings') {   // 💥💥💥 /api/settings는 GET/POST 모두 가능 💥💥💥
     return handleSettings(request, env);
   }
   // 💥💥💥 여기가 변경점! /api/schedule에 대한 OPTIONS 요청도 허용! 💥💥💥
   else if (url.pathname === '/api/schedule') { // GET이든 OPTIONS든 일단 이 경로로 들어옴
     if (request.method === 'GET') {
         return handleSchedule(request, env);
     } else if (request.method === 'OPTIONS') {        // /api/schedule에 대한 프리플라이트 요청은 204 No Content로 응답
          return new Response(null, {
             status: 204,
             headers: {
                 'Access-Control-Allow-Origin': '*',
                 'Access-Control-Allow-Methods': 'GET, OPTIONS', // GET과 OPTIONS 메서드 허용
                 'Access-Control-Allow-Headers': 'Content-Type,  X-User-Id, X-Chat-Id',
                 'Access-Control-Max-Age': '86400'
             }
         });
     }
   } 
   else if (url.pathname === '/' && request.method === 'GET') {   // 💥💥💥 루트 경로 ('/')는 GET 요청에 대한 응답만 💥💥💥
     return handleRootManualFetch(env);
   }
   return new Response('Not Found or Method Not Allowed', {   // ❓ 정의되지 않은 경로 또는 메서드 요청 시 Not Found 응답
     status: 404,
     headers: {
       'Access-Control-Allow-Origin': '*', // Not Found 응답에도 CORS 헤더 포함
       'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
       'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Chat-Id',
     }
   });
 },

 async scheduled(controller, env, ctx) { // ⏰ Cloudflare Scheduler (Cron Trigger) 이벤트 핸들러
   // 💥 CHAT_ID 대신 TELEGRAM_BOT_DEFAULT_CHAT_ID 사용 (env.CHAT_ID를 의미)
   const currentChatId = env.CHAT_ID;
   if (!currentChatId) {
     console.error("CHAT_ID environment variable is not set for scheduled tasks.");
     return;
   }  
   const nowKST = convertUTCtoKST(new Date());
   const targetDate = new Date(nowKST);
   targetDate.setHours(0, 0, 0, 0);
   const dutyInfoFull = await getDutyInfoFromSettingsKV(targetDate, env);  
   const hour = nowKST.getHours();
   const dutyType = dutyInfoFull.dutyType;
   const isNightDutyTime = (hour >= 0 && hour < 24) && (dutyType.includes('야'));
   const isDayDutyTime = (hour >= 0 && hour < 24) && (dutyType.includes('주'));
   const isOffDutyTime = (hour >= 0 && hour < 24) && (dutyType.includes('비'));
   const shouldSendMessage = isNightDutyTime || isDayDutyTime || isOffDutyTime;
   if (shouldSendMessage) {
     console.log("Scheduled Trigger (KST):", nowKST.toISOString());
     console.log("Scheduled Message:", dutyInfoFull.message);    
    //  const targetUrl = 'https://notifier-pages-frontend.pages.dev/'; // Mini App 프론트엔드 URL    
     const buttons = [
       [      
         { text: '👨‍🔧 당직 🗓 일정 👋', callback_data: 'request_mini_app_access' }   // 첫 번째 클릭은 콜백 데이터 전송 (미니앱 바로 열리지 않음)
       ]
     ];
       await sendTelegramMessage(env, dutyInfoFull.message, currentChatId, buttons);   // 💥 sendTelegramMessage 호출 시에는 currentChatId (봇이 알림을 보내는 대상 채팅방)를 사용
   } else {
     console.log("시간/당직 조건 불충족 또는 '비번' (메시지 미발송):", "\n", dutyInfoFull.message, "\n", "hour", hour, "shouldSendMessage", shouldSendMessage, "\n", "dutyType.includes('야간')", dutyType.includes('야간'), "\n", nowKST.toISOString().slice(11,19), "DutyType:", dutyInfoFull.dutyType);
   }
 },
};
