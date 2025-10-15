"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
// 메모리 폴백 저장 (Worker 인스턴스 재시작 시 사라짐)
var _inMemorySettings = null;
// 설정 조회 (KV 우선, 메모리 폴백)
function getSettings(env) {
    return __awaiter(this, void 0, void 0, function () {
        var value, e_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    if (!(env.SETTINGS_KV && typeof env.SETTINGS_KV.get === 'function')) return [3 /*break*/, 2];
                    return [4 /*yield*/, env.SETTINGS_KV.get('settings')];
                case 1:
                    value = _a.sent();
                    if (value) {
                        return [2 /*return*/, JSON.parse(value)];
                    }
                    _a.label = 2;
                case 2: return [3 /*break*/, 4];
                case 3:
                    e_1 = _a.sent();
                    console.error('Error reading settings from KV:', e_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/, _inMemorySettings || {}];
            }
        });
    });
}
// 설정 저장 (KV 우선, 메모리 폴백)
function saveSettings(env, body) {
    return __awaiter(this, void 0, void 0, function () {
        var e_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 4, , 5]);
                    if (!(env.SETTINGS_KV && typeof env.SETTINGS_KV.put === 'function')) return [3 /*break*/, 2];
                    return [4 /*yield*/, env.SETTINGS_KV.put('settings', JSON.stringify(body))];
                case 1:
                    _a.sent();
                    console.log('Saved settings to KV');
                    return [3 /*break*/, 3];
                case 2:
                    _inMemorySettings = body;
                    console.log('Saved settings to in-memory fallback');
                    _a.label = 3;
                case 3: return [3 /*break*/, 5];
                case 4:
                    e_2 = _a.sent();
                    console.error('Error saving settings:', e_2);
                    return [3 /*break*/, 5];
                case 5: return [2 /*return*/];
            }
        });
    });
}
/**
 * 날짜별 당직을 계산하는 핵심 로직 (주 주 야 야 비 비)
 * @param startDate YYYY-MM-DD
 * @param endDate YYYY-MM-DD
 * @param settings 설정 (baseDate, cycle, users)
 */
function calculateDuty(startDate, endDate, settings) {
    var baseDate = settings.baseDate, cycle = settings.cycle, users = settings.users;
    if (!baseDate || !cycle || !users || users.length === 0) {
        return []; // 설정 부족 시 빈 배열 반환
    }
    var dutyCycle = cycle.split(/\s+/).filter(Boolean); // "주 주 야 야 비 비" -> ["주", "주", "야", "야", "비", "비"]
    var baseDateMs = new Date(baseDate).setHours(0, 0, 0, 0);
    var dayMs = 24 * 60 * 60 * 1000;
    var schedule = [];
    var currentDateMs = new Date(startDate).setHours(0, 0, 0, 0);
    var endMs = new Date(endDate).setHours(0, 0, 0, 0);
    while (currentDateMs <= endMs) {
        var dateObj = new Date(currentDateMs);
        // 1. 기준일 대비 경과 일수 계산
        var daysPassed = Math.round((currentDateMs - baseDateMs) / dayMs);
        // 2. 일수와 근무자 수 기반으로 당직 종류(duty) 및 근무자(user) 결정
        var dutyIndex = daysPassed % dutyCycle.length; // 근무 주기 내 인덱스
        var userIndex = daysPassed % users.length; // 근무자 명단 내 인덱스
        var dutyType = dutyCycle[dutyIndex];
        var dutyUser = users[userIndex];
        // 3. 당직 할당 (간소화된 로직: dutyType에 따라 할당)
        var dayDuty = [];
        var nightDuty = [];
        if (dutyType === '주') {
            dayDuty.push(dutyUser);
        }
        else if (dutyType === '야') {
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
exports.default = {
    fetch: function (request, env, ctx) {
        return __awaiter(this, void 0, void 0, function () {
            var url, start, end, settings, schedule, body, e_3, settings, e_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = new URL(request.url);
                        // OPTIONS 프리플라이트 요청 처리
                        if (request.method === 'OPTIONS') {
                            return [2 /*return*/, new Response(null, {
                                    status: 204,
                                    headers: {
                                        'Access-Control-Allow-Origin': '*',
                                        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                                        'Access-Control-Allow-Headers': 'Content-Type',
                                        'Access-Control-Max-Age': '86400'
                                    }
                                })];
                        }
                        if (!(url.pathname === '/api/schedule')) return [3 /*break*/, 2];
                        if (!(request.method === 'GET')) return [3 /*break*/, 2];
                        start = url.searchParams.get('start');
                        end = url.searchParams.get('end');
                        if (!start || !end) {
                            return [2 /*return*/, new Response(JSON.stringify({ error: 'Missing start or end date query parameter' }), {
                                    status: 400,
                                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                                })];
                        }
                        return [4 /*yield*/, getSettings(env)];
                    case 1:
                        settings = _a.sent();
                        schedule = calculateDuty(start, end, settings);
                        return [2 /*return*/, new Response(JSON.stringify(schedule), {
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Access-Control-Allow-Origin': '*'
                                }
                            })];
                    case 2:
                        if (!(url.pathname === '/api/settings')) return [3 /*break*/, 11];
                        if (!(request.method === 'POST')) return [3 /*break*/, 7];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 6, , 7]);
                        return [4 /*yield*/, request.json()];
                    case 4:
                        body = _a.sent();
                        // 날짜 유효성 검사 등 필요 시 추가 가능
                        return [4 /*yield*/, saveSettings(env, body)];
                    case 5:
                        // 날짜 유효성 검사 등 필요 시 추가 가능
                        _a.sent();
                        return [2 /*return*/, new Response(JSON.stringify({ success: true, saved: body }), {
                                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                            })];
                    case 6:
                        e_3 = _a.sent();
                        return [2 /*return*/, new Response(JSON.stringify({ success: false, error: String(e_3) }), {
                                status: 400,
                                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                            })];
                    case 7:
                        if (!(request.method === 'GET')) return [3 /*break*/, 11];
                        _a.label = 8;
                    case 8:
                        _a.trys.push([8, 10, , 11]);
                        return [4 /*yield*/, getSettings(env)];
                    case 9:
                        settings = _a.sent();
                        return [2 /*return*/, new Response(JSON.stringify(settings), {
                                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                            })];
                    case 10:
                        e_4 = _a.sent();
                        return [2 /*return*/, new Response(JSON.stringify({ success: false, error: String(e_4) }), {
                                status: 500,
                                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                            })];
                    case 11: 
                    // 3. 기존의 /api/duty-list는 제거
                    return [2 /*return*/, new Response('Not Found', {
                            status: 404,
                            headers: { 'Access-Control-Allow-Origin': '*' }
                        })];
                }
            });
        });
    }
};
