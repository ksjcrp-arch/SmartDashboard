/**
 * [1] 글로벌 변수 및 설정
 */
let currentMode = null;
let currentTarget = null;
const SPECIAL_LIST = ['영어1', '영어2', '음악', '체육', '강사'];
let currentMealDate = new Date();
let sortableInstances = [];
let isEditMode = false;
let viewDate = new Date(); // 달력 기준 날짜
let selectedDateKey = null; // 현재 선택된 날짜 저장용
// [script.js 상단 설정 구역]
const SHARED_FOLDER_ID = '1l12mPq1kJu_BzHLuDInPWxVSoe8NcRIJ'; // 📍 필수 수정

// 상수 설정
const ATPT_CODE = 'D10';   // 대구교육청
const SCHUL_CODE = '7281024'; // 유가초등학교
const GAS_APP_URL = "https://script.google.com/macros/s/AKfycbwfxVR_NWeP5Ekh74dM_ib7Lhd78to0ijswqcyeapK-AelSfGz8YdS96d1Z5uyUyxHv/exec";
const SPREADSHEET_ID = '1i13Yl1giTW1-LW7OQHxg7uUu11NVQnKQlf-PJgViOnE';

/**
 * [2] 통합 데이터 저장 시스템 (LocalStorage 완결판)
 */

// 💾 모든 데이터 저장 (퀵런처, 디데이, 캘린더 개인일정, 투두)
function saveAllToLocal() {
    const data = {
        launchers: [],
        ddays: [],
        calendarEvents: [],
        todos: []
    };

    // 🚀 퀵런처 데이터 추출
    document.querySelectorAll('#launcher-container .launch-item').forEach(item => {
        data.launchers.push({
            title: item.querySelector('span:not(.material-symbols-rounded)').innerText,
            url: item.href
        });
    });

    // ⏳ 디데이 데이터 추출
    document.querySelectorAll('#dday-container .d-day-item').forEach(item => {
        data.ddays.push({
            title: item.querySelector('.d-label').innerText,
            date: item.querySelector('.d-date').innerText.replace(/-/g, '')
        });
    });

    // ✅ 투두 데이터 추출
    document.querySelectorAll('#todo-container .todo-item').forEach(item => {
        data.todos.push({
            text: item.querySelector('.todo-content').innerText,
            completed: item.classList.contains('completed')
        });
    });

    // 📅 캘린더 개인 일정 (기존 저장된 데이터 유지하며 업데이트)
    const existingData = JSON.parse(localStorage.getItem('yuga_dashboard_v1') || '{}');
    data.calendarEvents = existingData.calendarEvents || [];

    localStorage.setItem('yuga_dashboard_v1', JSON.stringify(data));
    console.log("모든 데이터가 로컬 저장소에 안전하게 기록되었습니다.");
}

// 📂 저장된 데이터 불러오기 및 화면 복원
function loadAllFromLocal() {
    const rawData = localStorage.getItem('yuga_dashboard_v1');
    const DEFAULT_LAUNCHERS = [
        { title: '업무포털', url: 'https://dge.eduptl.kr' },
        { title: '학교홈피', url: 'https://yuga.dge.es.kr' }
    ];

    let data = rawData ? JSON.parse(rawData) : { launchers: DEFAULT_LAUNCHERS, ddays: [], calendarEvents: [], todos: [] };

    // 🚀 퀵런처 복원
    const launcherContainer = document.getElementById('launcher-container');
    if (launcherContainer) {
        launcherContainer.innerHTML = '';
        const launchers = (data.launchers && data.launchers.length > 0) ? data.launchers : DEFAULT_LAUNCHERS;
        launchers.forEach(l => renderLauncherItem(l.title, l.url));
    }

    // ⏳ 디데이 복원
    const ddayContainer = document.getElementById('dday-container');
    if (ddayContainer) {
        ddayContainer.innerHTML = '';
        if (data.ddays) data.ddays.forEach(d => renderDDayItem(d.title, d.date));
    }

    // ✅ 투두 복원
    const todoContainer = document.getElementById('todo-container');
    if (todoContainer) {
        todoContainer.innerHTML = '';
        if (data.todos) data.todos.forEach(t => renderTodoItem(t.text, t.completed));
    }
}

/**
 * [3] 퀵런처 기능
 */
function toggleLauncherInput() {
    const box = document.getElementById('launcher-input-box');
    // 📍 닫힐 때(창이 열려있는 상태에서 누를 때) 입력 필드 초기화
    if (box.style.display !== 'none') {
        document.getElementById('launcher-title').value = '';
        document.getElementById('launcher-url').value = '';
    }
    box.style.display = (box.style.display === 'none') ? 'block' : 'none';
}

function renderLauncherItem(title, url) {
    const container = document.getElementById('launcher-container');
    const newItem = document.createElement('a');
    newItem.href = url;
    newItem.target = "_blank";
    newItem.className = "launch-item";
    newItem.innerHTML = `
        <span class="material-symbols-rounded">link</span>
        <span>${title}</span>
        <span class="material-symbols-rounded btn-del-launcher" 
              onclick="event.preventDefault(); event.stopPropagation(); this.parentElement.remove(); saveAllToLocal();">cancel</span>
    `;
    container.appendChild(newItem);
}

function addNewLauncher() {
    const title = document.getElementById('launcher-title').value;
    let url = document.getElementById('launcher-url').value;
    if (!title || !url) return;
    if (!url.startsWith('http')) url = 'https://' + url;

    renderLauncherItem(title, url);
    saveAllToLocal();
    document.getElementById('launcher-title').value = '';
    document.getElementById('launcher-url').value = '';
    toggleLauncherInput();
}

/**
 * [4] 캘린더 로직 (나이스 연동 + 개인일정)
 */
async function fetchSchoolSchedule(year, month) {
    const yymm = `${year}${String(month + 1).padStart(2, '0')}`;
    const url = `https://open.neis.go.kr/hub/SchoolSchedule?Type=json&ATPT_OFCDC_SC_CODE=${ATPT_CODE}&SD_SCHUL_CODE=${SCHUL_CODE}&AA_YMD=${yymm}`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        return data.SchoolSchedule ? data.SchoolSchedule[1].row : [];
    } catch (e) {
        console.error("나이스 호출 실패:", e);
        return [];
    }
}

async function renderCalendar() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const monthTitle = document.getElementById('calendar-month-year');
    if (monthTitle) monthTitle.innerHTML = `<span class="material-symbols-rounded">calendar_month</span> ${year}년 ${month + 1}월`;

    const scheduleData = await fetchSchoolSchedule(year, month);
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;

    const headers = grid.querySelectorAll('.day-header');
    grid.innerHTML = '';
    headers.forEach(h => grid.appendChild(h));

    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    let allMonthEvents = [];

    for (let i = 0; i < firstDay; i++) {
        grid.appendChild(document.createElement('div')).className = 'day empty';
    }

    for (let i = 1; i <= lastDate; i++) {
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day';
        dayDiv.innerText = i;

        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const dateStr = dateKey.replace(/-/g, '');
        const dayOfWeek = new Date(year, month, i).getDay();

        let dayPlan = scheduleData.find(d => d.AA_YMD === dateStr);
        if (dayPlan && dayPlan.EVENT_NM === "토요휴업일") dayPlan = null;
        const personalEvent = getPersonalEvent(dateKey);

        if (dayOfWeek === 0 || (dayPlan && dayPlan.SBTR_DD_SC_NM === "휴업일")) {
            dayDiv.style.color = "#ff6b6b";
        } else if (dayOfWeek === 6) {
            dayDiv.style.color = "#4dabf7";
        }

        const today = new Date();
        if (year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {
            dayDiv.classList.add('active');
        }

        if (dayPlan || personalEvent) {
            dayDiv.classList.add('event');
            if (dayPlan) allMonthEvents.push({ day: i, desc: dayPlan.EVENT_NM, type: 'school' });
            if (personalEvent) allMonthEvents.push({ day: i, desc: personalEvent.desc, type: 'personal' });
        }

        dayDiv.onclick = () => openEventModal(dateKey);
        grid.appendChild(dayDiv);
    }
    updateMonthlyEventList(allMonthEvents, month + 1);
}

function updateMonthlyEventList(events, currentMonth) {
    const listContainer = document.getElementById('monthly-event-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    events.sort((a, b) => a.day - b.day);

    if (events.length === 0) {
        listContainer.innerHTML = '<div class="event-row" style="justify-content:center; opacity:0.5; font-size:0.8rem; padding:10px;">이번 달 일정이 없습니다.</div>';
    } else {
        events.forEach(ev => {
            const row = document.createElement('div');
            row.className = 'event-row';
            row.innerHTML = `<span class="event-date">${currentMonth}/${ev.day}</span><span class="event-desc">${ev.type === 'personal' ? '📌 ' : ''}${ev.desc}</span>`;
            listContainer.appendChild(row);
        });
    }
}

function changeMonth(offset) {
    viewDate.setMonth(viewDate.getMonth() + offset);
    renderCalendar();
}

function getPersonalEvent(dateKey) {
    const data = JSON.parse(localStorage.getItem('yuga_dashboard_v1') || '{"calendarEvents":[]}');
    return data.calendarEvents?.find(e => e.date === dateKey);
}

function openEventModal(dateKey) {
    selectedDateKey = dateKey;
    const existingEvent = getPersonalEvent(dateKey);
    document.getElementById('event-modal-title').innerText = `${dateKey} 일정`;
    const input = document.getElementById('input-event-desc');
    input.value = existingEvent ? existingEvent.desc : "";
    document.getElementById('btn-del-event').style.display = existingEvent ? "block" : "none";
    document.getElementById('modal-event').style.display = 'flex';
    input.focus();
}

function closeEventModal() { document.getElementById('modal-event').style.display = 'none'; }

document.getElementById('btn-save-event').onclick = function () {
    const desc = document.getElementById('input-event-desc').value.trim();
    if (!desc) return alert("내용을 입력해주세요!");
    updateEventData(selectedDateKey, desc);
    closeEventModal();
    renderCalendar();
};

document.getElementById('btn-del-event').onclick = function () {
    if (confirm("이 일정을 삭제하시겠습니까?")) {
        updateEventData(selectedDateKey, "");
        closeEventModal();
        renderCalendar();
    }
};

function updateEventData(dateKey, desc) {
    let data = JSON.parse(localStorage.getItem('yuga_dashboard_v1') || '{"calendarEvents":[]}');
    if (!data.calendarEvents) data.calendarEvents = [];
    data.calendarEvents = data.calendarEvents.filter(e => e.date !== dateKey);
    if (desc !== "") data.calendarEvents.push({ date: dateKey, desc: desc });
    localStorage.setItem('yuga_dashboard_v1', JSON.stringify(data));
}

/**
 * [5] 디데이 기능
 */
function toggleDDayInput() {
    const inputField = document.getElementById('inline-dday-input');
    // 📍 닫힐 때 입력 필드 초기화
    if (inputField.style.display !== 'none') {
        document.getElementById('dday-title').value = "";
        document.getElementById('dday-target-date').value = "";
    }
    inputField.style.display = (inputField.style.display === 'none') ? 'block' : 'none';
}

function calculateDDay(targetDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(`${targetDate.substring(0, 4)}-${targetDate.substring(4, 6)}-${targetDate.substring(6, 8)}`);
    const diff = target - today;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days === 0 ? "D-Day" : (days > 0 ? `D-${days}` : `D+${Math.abs(days)}`);
}

function renderDDayItem(title, dateInput) {
    const dDayText = calculateDDay(dateInput);
    const container = document.getElementById('dday-container');
    const newItem = document.createElement('div');
    newItem.className = 'd-day-item';
    newItem.innerHTML = `
        <div class="d-info"><span class="d-label">${title}</span><span class="d-date">${dateInput.substring(0, 4)}-${dateInput.substring(4, 6)}-${dateInput.substring(6, 8)}</span></div>
        <div class="d-right"><span class="d-count">${dDayText}</span><button class="btn-del-dday" onclick="this.parentElement.parentElement.remove(); saveAllToLocal();"><span class="material-symbols-rounded">delete</span></button></div>
    `;
    container.prepend(newItem);
}

function addNewDDay() {
    const title = document.getElementById('dday-title').value;
    const dateInput = document.getElementById('dday-target-date').value;
    if (dateInput.length !== 8 || !title) return alert("입력값을 확인하세요!");
    renderDDayItem(title, dateInput);
    saveAllToLocal();
    toggleDDayInput();
}

/**
 * [6] 시간표 및 공지사항
 */
function getTargetSheetName() {
    const now = new Date();
    const day = now.getDay();
    const gap = (day === 0 ? 6 : day - 1);
    const monday = new Date(now);
    monday.setDate(now.getDate() - gap);
    return `${monday.getMonth() + 1}.${monday.getDate()}.`;
}

async function selectView(mode, value, btn) {
    document.querySelectorAll('.chip, .m-chip').forEach(chip => chip.classList.remove('active'));
    if (btn) btn.classList.add('active');
    currentMode = mode; currentTarget = value;
    const displayTarget = document.getElementById('selected-target-name');
    if (displayTarget) displayTarget.innerText = `(${value})`;
    await refreshTimetableData();
}

async function fetchNotices() {
    try {
        const response = await fetch(GAS_APP_URL);
        const notices = await response.json();
        const container = document.getElementById('notice-display-area');
        if (notices.length === 0) {
            container.innerHTML = "<p class='empty-text'>등록된 공지가 없습니다.</p>";
            return;
        }
        container.innerHTML = notices.map(msg => `<div class="notice-item"><p class="notice-text">${msg}</p></div>`).join('');
    } catch (e) { console.error(e); }
}

async function submitNotice() {
    const textInput = document.getElementById('input-notice-text');
    const text = textInput.value.trim();
    if (!text) return;
    const container = document.getElementById('notice-display-area');
    textInput.value = ''; closeNoticeModal();
    container.innerHTML = `<div class="notice-waiting"><span class="material-symbols-rounded loading-spinner">sync</span><p>공지사항을 기록 중입니다...</p></div>`;
    try {
        const response = await fetch(GAS_APP_URL, { method: 'POST', body: text });
        if (response.ok) fetchNotices();
    } catch (e) { container.innerHTML = `<p class="error-text">기록에 실패했습니다.</p>`; }
}

function openNoticeModal() { document.getElementById('modal-notice').style.display = 'flex'; }
function closeNoticeModal() {
    // 📍 닫을 때 입력 필드 초기화
    document.getElementById('input-notice-text').value = '';
    document.getElementById('modal-notice').style.display = 'none';
}

let cachedSheetData = null;
let lastSheetName = "";

async function refreshTimetableData() {
    if (!currentMode || !currentTarget) return;
    document.getElementById('initial-selector').style.display = 'none';
    document.getElementById('view-mini-weekly').style.display = 'block';
    const sheetName = getTargetSheetName();
    const FETCH_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

    try {
        let rows;
        if (cachedSheetData && lastSheetName === sheetName) {
            rows = cachedSheetData;
        } else {
            const res = await fetch(FETCH_URL);
            const csvData = await res.text();
            rows = csvData.split('\n').map(row => row.split(',').map(cell => cell.replace(/^"(.*)"$/, '$1').trim()));
            cachedSheetData = rows; lastSheetName = sheetName;
        }

        let timetableData = Array.from({ length: 7 }, () => Array(5).fill('-'));
        rows.forEach((row, rIdx) => {
            if (rIdx < 1) return;
            const period = parseInt(row[0]);
            if (!period || period > 7) return;
            for (let day = 0; day < 5; day++) {
                const startCol = 1 + (day * 5);
                if (currentMode === 'class') {
                    for (let sIdx = 0; sIdx < 5; sIdx++) {
                        if (row[startCol + sIdx] === currentTarget) timetableData[period - 1][day] = SPECIAL_LIST[sIdx];
                    }
                } else {
                    const subIdx = SPECIAL_LIST.indexOf(currentTarget);
                    timetableData[period - 1][day] = row[startCol + subIdx] || '-';
                }
            }
        });
        renderMiniWeeklyTable(timetableData);
        renderWeeklyTable(timetableData);
        highlightCurrentPeriod();
    } catch (e) { console.error(e); }
}

function renderMiniWeeklyTable(data) {
    const tbody = document.getElementById('mini-weekly-tbody');
    let html = '';
    for (let i = 0; i < 6; i++) {
        html += `<tr><th>${i + 1}</th>`;
        for (let j = 0; j < 5; j++) {
            const cell = data[i][j];
            const isSpecial = SPECIAL_LIST.includes(cell);
            html += `<td style="${isSpecial ? 'color:#ffcc00; font-weight:bold;' : ''}">${(cell === '담임' || cell === '-') ? "" : cell}</td>`;
        }
        html += `</tr>`;
    }
    tbody.innerHTML = html;
}

function resetTimetableSelection() {
    document.getElementById('view-mini-weekly').style.display = 'none';
    document.getElementById('initial-selector').style.display = 'block';
    document.getElementById('selected-target-name').innerText = "";
    currentMode = null; currentTarget = null;
}

function renderWeeklyTable(data) {
    const tbody = document.getElementById('weekly-tbody');
    let html = '';
    data.forEach((row, i) => {
        html += `<tr><th>${i + 1}</th>`;
        row.forEach(cell => {
            const isSpecial = SPECIAL_LIST.includes(cell);
            html += `<td ${isSpecial ? 'class="special"' : ''}>${(cell === '담임' || cell === '-') ? "" : cell}</td>`;
        });
        html += `</tr>`;
    });
    tbody.innerHTML = html;
}

/**
 * ⏰ 요일별 시정을 반영한 현재 교시 하이라이트 기능
 */
function highlightCurrentPeriod() {
    const now = new Date();
    const day = now.getDay(); // 0(일) ~ 6(토)

    // 주말(토, 일)은 실행 안 함
    if (day === 0 || day === 6) return;

    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // 1️⃣ 월, 화, 목, 금 표준 시정 (6~7교시)
    const commonTime = [
        { p: 1, s: '08:50', e: '09:29' },
        { p: 2, s: '09:35', e: '10:14' },
        { p: 3, s: '10:25', e: '11:04' },
        { p: 4, s: '11:10', e: '11:49' },
        { p: 5, s: '12:00', e: '12:39' },
        { p: 6, s: '13:40', e: '14:19' }
    ];

    // 2️⃣ 수요일 전용 시정 (5교시 및 빠른 하교 반영)
    const wednesdayTime = [
        { p: 1, s: '08:40', e: '09:19' },
        { p: 2, s: '09:20', e: '09:59' },
        { p: 3, s: '10:10', e: '10:49' },
        { p: 4, s: '10:50', e: '11:29' },
        { p: 5, s: '11:30', e: '12:19' } // 수요일 5교시 예시 시간
    ];

    // 현재 요일에 맞는 시정 선택
    const activeSchedule = (day === 3) ? wednesdayTime : commonTime;

    // 현재 시간에 해당하는 교시 찾기
    const currentP = activeSchedule.find(t => currentTimeStr >= t.s && currentTimeStr <= t.e)?.p;

    // 기존 하이라이트 제거
    document.querySelectorAll('.current-period').forEach(el => el.classList.remove('current-period'));

    // 현재 교시가 있다면 해당 칸 강조
    if (currentP) {
        const tables = document.querySelectorAll('.mini-weekly-table, .weekly-table');

        tables.forEach(table => {
            const rows = table.querySelectorAll('tbody tr');
            const targetRow = rows[currentP - 1];
            if (targetRow) {
                // 월요일이 1번 td이므로 day index를 그대로 사용
                const targetCell = targetRow.querySelectorAll('td')[day - 1];
                if (targetCell) {
                    targetCell.classList.add('current-period');
                }
            }
        });
    }
}

/**
 * [7] 투두리스트
 */
function toggleTodoInput() {
    const box = document.getElementById('todo-input-box');
    // 📍 닫힐 때 입력 필드 초기화
    if (box.style.display !== 'none') {
        document.getElementById('todo-text').value = '';
    }
    box.style.display = (box.style.display === 'none') ? 'block' : 'none';
    if (box.style.display === 'block') document.getElementById('todo-text').focus();
}

function addTodo() {
    const input = document.getElementById('todo-text');
    if (!input.value.trim()) return;
    renderTodoItem(input.value.trim(), false);
    input.value = ''; saveAllToLocal();
}

function renderTodoItem(text, isCompleted) {
    const container = document.getElementById('todo-container');
    const item = document.createElement('div');
    item.className = `todo-item ${isCompleted ? 'completed' : ''}`;
    item.innerHTML = `
        <div class="todo-item-left" onclick="toggleTodoStatus(this)">
            <span class="material-symbols-rounded check-icon">${isCompleted ? 'check_box' : 'check_box_outline_blank'}</span>
            <span class="todo-content">${text}</span>
        </div>
        <span class="material-symbols-rounded btn-del-todo" onclick="this.parentElement.remove(); saveAllToLocal();">delete</span>
    `;
    container.prepend(item);
}

function toggleTodoStatus(el) {
    const item = el.parentElement;
    item.classList.toggle('completed');
    el.querySelector('.check-icon').innerText = item.classList.contains('completed') ? 'check_box' : 'check_box_outline_blank';
    saveAllToLocal();
}

/**
 * [8] 정보 그리드 및 환경 설정
 */
function updateInfoGrid() {
    const now = new Date();
    const week = ['일', '월', '화', '수', '목', '금', '토'];
    document.getElementById('info-date').innerText = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 (${week[now.getDay()]})`;
    const h = String(now.getHours()).padStart(2, '0'), m = String(now.getMinutes()).padStart(2, '0'), s = String(now.getSeconds()).padStart(2, '0');
    document.getElementById('info-clock').innerHTML = `<span class="clock-main">${h}:${m}</span><small class="clock-seconds">:${s}</small>`;
}

async function fetchRealTimeWeather() {
    try {
        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=35.7726&lon=128.4691&appid=2dff9b605180bb798f6ac365483d2ef8&units=metric&lang=kr`);
        const data = await res.json();
        if (data.main) {
            document.getElementById('info-temp').innerText = `${Math.round(data.main.temp)}°C`;
            const code = data.weather[0].icon;
            document.getElementById('info-weather-icon').innerText = code.includes('01') ? 'wb_sunny' : (code.includes('02') ? 'partly_cloudy_day' : 'cloud');
        }
    } catch (e) { console.error(e); }
}

async function fetchAirQuality() {
    const dustWidget = document.getElementById('info-dust');
    try {
        const res = await fetch(`https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty?stationName=${encodeURIComponent('유가읍')}&dataTerm=daily&ver=1.0&returnType=json&serviceKey=41130df3a53739396fffc665e1095269d1833f384cb922f4cae318b3f1f2554e`);
        const data = await res.json();
        const item = data.response.body.items[0];
        const gradeNum = Math.max(Number(item.pm10Grade), Number(item.pm25Grade));
        const grades = ["", "좋음", "보통", "나쁨", "매우나쁨"], icons = ["", "sentiment_very_satisfied", "sentiment_satisfied", "sentiment_dissatisfied", "sick"];
        dustWidget.innerHTML = `<div class="air-header"><span class="material-symbols-rounded" style="font-size:2rem;">${icons[gradeNum] || "help"}</span><div class="air-status-text"><span class="air-label">미세먼지</span><span class="air-grade-val">${grades[gradeNum] || "정보없음"}</span></div></div><div class="air-details-grid"><div class="air-item"><div class="air-item-label">미세</div><div class="air-item-val">${item.pm10Value}㎍</div></div><div class="air-item"><div class="air-item-label">초미세</div><div class="air-item-val">${item.pm25Value}㎍</div></div></div>`;
    } catch (e) { console.error(e); }
}

async function displayMeal() {
    const ymd = currentMealDate.getFullYear() + String(currentMealDate.getMonth() + 1).padStart(2, '0') + String(currentMealDate.getDate()).padStart(2, '0');
    document.getElementById('meal-display-date').innerText = `${currentMealDate.getFullYear()}-${String(currentMealDate.getMonth() + 1).padStart(2, '0')}-${String(currentMealDate.getDate()).padStart(2, '0')}`;
    try {
        const res = await fetch(`https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=D10&SD_SCHUL_CODE=7281024&MLSV_YMD=${ymd}`);
        const data = await res.json();
        if (data.mealServiceDietInfo) {
            const row = data.mealServiceDietInfo[1].row[0];
            document.getElementById('meal-text').innerText = row.DDISH_NM.replace(/<br\/>/g, ', ').replace(/\([0-9.]*\)/g, '');
            document.getElementById('meal-calories').innerText = row.CAL_INFO.replace(' Kcal', '');
        } else {
            document.getElementById('meal-text').innerText = "급식 정보가 없습니다. 😴";
            document.getElementById('meal-calories').innerText = "0";
        }
    } catch (e) { console.error(e); }
}

function changeMealDate(offset) { currentMealDate.setDate(currentMealDate.getDate() + offset); displayMeal(); }

function changeRandomBackground() {
    const url = `https://picsum.photos/1920/1080?random=${Math.random()}`;
    document.body.style.background = `linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('${url}') no-repeat center center / cover fixed`;
}

function toggleTheme() {
    const themes = ['dark', 'navy', 'forest', 'pink'];
    const cur = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = themes[(themes.indexOf(cur) + 1) % themes.length];
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('yuga_dashboard_theme', next);
}

function initTheme() {
    document.documentElement.setAttribute('data-theme', localStorage.getItem('yuga_dashboard_theme') || 'dark');
}

/**
 * 🔄 모달 단계 전환 및 초기화
 */
function showStep(stepId) {
    document.querySelectorAll('.step-container').forEach(el => el.style.display = 'none');
    document.getElementById(stepId).style.display = 'block';

    // 불러오기 탭으로 갈 때마다 목록 영역 초기화
    if (stepId === 'step-load') {
        document.getElementById('cloud-file-list').style.display = 'none';
        document.getElementById('load-auth-area').style.display = 'block';
    }
}

function openBackupModal() {
    document.getElementById('modal-backup').style.display = 'flex';
    showStep('step-main');
}

function closeBackupModal() {
    document.getElementById('modal-backup').style.display = 'none';
}

// script.js 내 exportSettingsToFile 함수 보정
function exportSettingsToFile() {
    const localData = localStorage.getItem('yuga_dashboard_v1');
    const themeData = localStorage.getItem('yuga_dashboard_theme');

    const fullConfig = {
        data: JSON.parse(localData),
        theme: themeData,
        exportedAt: new Date().toLocaleString()
    };

    let fileName = `yuga_backup_${new Date().toISOString().slice(0, 10)}.json`;

    const blob = new Blob([JSON.stringify(fullConfig, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;

    // 📍 라이블리 월페이퍼 환경을 위한 보정
    document.body.appendChild(link); // 링크를 문서에 실제 추가
    link.click();                    // 클릭 트리거
    document.body.removeChild(link);  // 클릭 후 즉시 제거

    URL.revokeObjectURL(url);
}

function importSettingsFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const config = JSON.parse(e.target.result);
            if (config.data) localStorage.setItem('yuga_dashboard_v1', JSON.stringify(config.data));
            if (config.theme) localStorage.setItem('yuga_dashboard_theme', config.theme);
            showToast("설정 복구 완료! 곧 새로고침합니다.");
            setTimeout(() => location.reload(), 1000);
        } catch (err) { showToast("파일 형식이 올바르지 않습니다."); }
    };
    reader.readAsText(file);
}

/**
 * 💾 1. 현재 그리드 배치 순서를 로컬 스토리지에 저장 (Write)
 */
function saveGridOrder() {
    const columns = document.querySelectorAll('.column');
    const orderData = {};

    columns.forEach((col) => {
        // 해당 컬럼 안에 있는 카드들의 ID만 추출 (공백이나 ID 없는 요소 제외)
        const cardIds = Array.from(col.querySelectorAll('.card'))
            .map(card => card.id)
            .filter(id => id);
        orderData[col.id] = cardIds;
    });

    localStorage.setItem('yuga_grid_layout', JSON.stringify(orderData));
}

function toggleEditMode() {
    isEditMode = !isEditMode;
    const btn = document.getElementById('btn-edit-mode'), cols = document.querySelectorAll('.column'), dash = document.querySelector('.dashboard-grid');
    if (isEditMode) {
        dash.classList.add('edit-mode-active');
        btn.classList.add('active-edit');
        btn.querySelector('span').innerText = 'check';
        sortableInstances = [];
        cols.forEach(col => {
            const inst = new Sortable(col, { group: 'shared', animation: 150, ghostClass: 'ghost', handle: '.card-header', forceFallback: true });
            sortableInstances.push(inst);
        });
        showToast("편집 모드 (위치 저장은 되지 않습니다)");
    } else {
        dash.classList.remove('edit-mode-active');
        btn.classList.remove('active-edit');
        btn.querySelector('span').innerText = 'settings';
        sortableInstances.forEach(inst => inst.destroy());
        saveAllToLocal(); // 편집 종료 시 데이터 상태 저장
        // 📍 [핵심] 여기서 위치와 데이터를 동시에 저장합니다!
        saveGridOrder();   // 위치 저장
        saveAllToLocal();  // 데이터(일정 등) 저장
        showToast("편집 종료");
    }
}
/**
 * 📂 2. 저장된 순서대로 카드 재배치 (Read)
 */
function loadGridOrder() {
    const savedOrder = localStorage.getItem('yuga_grid_layout');
    if (!savedOrder) return;

    const orderData = JSON.parse(savedOrder);

    // 1. 현재 화면에 있는 모든 카드를 찾아서 메모리에 보관
    const allCards = {};
    document.querySelectorAll('.card').forEach(card => {
        if (card.id) {
            allCards[card.id] = card;
        }
    });

    // 2. 저장된 레이아웃 순서대로 카드를 다시 꽂아줌
    Object.keys(orderData).forEach(columnId => {
        const targetColumn = document.getElementById(columnId);
        if (targetColumn) {
            orderData[columnId].forEach(cardId => {
                if (allCards[cardId]) {
                    targetColumn.appendChild(allCards[cardId]);
                }
            });
        }
    });
}
function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="material-symbols-rounded" style="color:var(--accent); font-size:1.2rem;">check_circle</span> ${msg}`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 2500);
}



/* --------------------------------------------------------------------------
   ☁️ Google Drive API 동기화 로직
   -------------------------------------------------------------------------- */

// 📍 구글 클라우드 콘솔에서 발급받은 정보 입력
const CLIENT_ID = '777239839380-mp51geihmtfp525tpejh5ue723jh8lum.apps.googleusercontent.com';
const API_KEY = 'AIzaSyBtTr6kwWThu6ewNpJ2NxOzJwH6AmQjT_8';
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';


// script.js 상단 혹은 적절한 위치에 추가
function gapiLoaded() {
    gapi.load('client', async () => {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
        });
        gapiInited = true;
        console.log("GAPI 초기화 완료"); // 확인용
    });
}

function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '',
    });
    gisInited = true;
    console.log("GIS 초기화 완료"); // 확인용
}

/**
 * 🔐 구글 드라이브에 설정 파일 업로드
 */
/**
 * 🔐 [1] 구글 드라이브 백업 실행 (파일명 지정 및 폴더 생성 포함)
 */
async function uploadConfigToDrive() {
    try {
        // 1. 현재 날짜/시간 기반으로 기본 파일명 생성
        const now = new Date();
        const defaultName = `backup_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

        // 2. 사용자에게 파일 이름 입력 받기
        const fileName = prompt("백업 파일 이름을 입력하세요:", defaultName);
        if (!fileName) return; // 취소 시 중단

        showToast("구글 드라이브 연결 중...");

        // 3. "YugaSmartDashboard" 전용 폴더 ID 확보 (없으면 자동 생성)
        const folderId = await getOrCreateFolder("YugaSmartDashboard");

        // 4. 로컬 스토리지 데이터 수집
        const localData = localStorage.getItem('yuga_dashboard_v1');
        const themeData = localStorage.getItem('yuga_dashboard_theme');
        const content = JSON.stringify({
            data: JSON.parse(localData),
            theme: themeData,
            savedAt: new Date().toLocaleString()
        });

        // 5. 업로드용 메타데이터 및 파일 데이터 준비
        const fileMetadata = {
            'name': fileName + ".json",
            'parents': [folderId], // 생성한 전용 폴더 안에 저장
            'mimeType': 'application/json'
        };

        const blob = new Blob([content], { type: 'application/json' });
        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
        formData.append('file', blob);

        // 6. Multipart 업로드 API 호출
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + gapi.client.getToken().access_token }),
            body: formData
        });

        if (response.ok) {
            showToast("전용 폴더(YugaSmartDashboard)에 백업 완료!");
        } else {
            throw new Error("업로드 실패");
        }
    } catch (err) {
        console.error("백업 오류:", err);
        showToast("백업 중 오류가 발생했습니다.");
    }
}

/**
 * 📂 [2] 전용 폴더 존재 여부를 확인하고 없으면 새로 생성하는 함수
 */
async function getOrCreateFolder(folderName) {
    // 폴더 검색 쿼리: 이름이 일치하고, 휴지통에 없으며, 마임타입이 폴더인 것 검색
    const query = `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
    const response = await gapi.client.drive.files.list({ q: query, fields: 'files(id, name)' });
    const files = response.result.files;

    if (files && files.length > 0) {
        // 이미 폴더가 존재하면 해당 ID 반환
        return files[0].id;
    } else {
        // 폴더가 없으면 새로 생성
        const folderMetadata = {
            'name': folderName,
            'mimeType': 'application/vnd.google-apps.folder'
        };
        const folder = await gapi.client.drive.files.create({
            resource: folderMetadata,
            fields: 'id'
        });
        console.log("새 폴더 생성 완료:", folder.result.id);
        return folder.result.id;
    }
}

// [script.js] handleSignoutClick 함수 수정
function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');

        // ✅ 자동 로그인 기록 삭제
        localStorage.removeItem('gdrive_logged_in');

        showToast("로그아웃 되었습니다.");
        setTimeout(() => location.reload(), 1000);
    }
}

// 기존 saveToGoogleDrive 이름을 handleAuthClick으로 변경
// [script.js의 handleAuthClick 함수 수정]
function handleAuthClick() {
    if (!tokenClient) {
        showToast("구글 라이브러리 로딩 중입니다. 잠시 후 다시 시도해 주세요.");
        return;
    }

    // [script.js] handleAuthClick 함수 내부 수정
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) throw (resp);

        // ✅ 로그인 성공 시 로컬 스토리지에 기록 (보안상 토큰 대신 '로그인 여부'만 저장)
        localStorage.setItem('gdrive_logged_in', 'true');

        const loginBtn = document.getElementById('btn-google-login');
        const authStatus = document.getElementById('google-auth-status');
        if (loginBtn) loginBtn.style.display = 'none';
        if (authStatus) authStatus.style.display = 'block';

        showToast("구글 계정 인증 성공!");
    };

    // 토큰 요청 (이미 있으면 바로 콜백 실행)
    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

// [script.js 하단부의 loadConfigFromDrive 및 관련 함수들 교체]

/**
 * 📂 [2] 공유 폴더 내 파일 목록 가져오기
 */
async function loadConfigFromDrive() {
    closeBackupModal();
    const modal = document.getElementById('modal-restore-list');
    const listContainer = document.getElementById('restore-file-list');

    if (modal) modal.style.display = 'flex';
    if (listContainer) listContainer.innerHTML = '<div class="loading-spinner">데이터 암호화 확인 중...</div>';

    try {
        // 📍 공유 폴더 내의 파일만 검색하도록 쿼리 수정
        const response = await gapi.client.drive.files.list({
            q: `'${SHARED_FOLDER_ID}' in parents and trashed = false`,
            fields: 'files(id, name, createdTime)',
            orderBy: 'createdTime desc'
        });

        const files = response.result.files;
        renderRestoreList(files);
    } catch (err) {
        console.error("목록 가져오기 실패:", err);
        if (listContainer) listContainer.innerHTML = '<div class="error-text">폴더 접근 권한이 없습니다.</div>';
    }
}

function renderRestoreList(files) {
    const listContainer = document.getElementById('restore-file-list');
    if (!listContainer) return;

    if (!files || files.length === 0) {
        listContainer.innerHTML = '<div class="no-data-text">저장된 백업 파일이 없습니다.</div>';
        return;
    }

    let listHtml = '';
    files.forEach((file) => {
        const formattedDate = new Date(file.createdTime).toLocaleString();
        listHtml += `
            <div class="restore-item" onclick="downloadAndRestoreFile('${file.id}', '${file.name}')">
                <span class="material-symbols-rounded" style="color:var(--accent)">description</span>
                <div class="restore-item-info">
                    <div class="restore-item-name">${file.name}</div>
                    <div class="restore-item-date">${formattedDate}</div>
                </div>
                <span class="material-symbols-rounded" style="opacity:0.3">chevron_right</span>
            </div>
        `;
    });
    listContainer.innerHTML = listHtml;
}

async function downloadAndRestoreFile(fileId, fileName) {
    if (!confirm(`'${fileName}' 시점으로 복구하시겠습니까?`)) return;

    closeRestoreModal();
    showToast("데이터 복구 중...");

    try {
        const fileContent = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });

        const config = fileContent.result;
        if (config.data) localStorage.setItem('yuga_dashboard_v1', JSON.stringify(config.data));
        if (config.theme) localStorage.setItem('yuga_dashboard_theme', config.theme);

        showToast("복구 완료! 새로고침합니다.");
        setTimeout(() => location.reload(), 1500);
    } catch (err) {
        console.error("복구 실패:", err);
        showToast("복구 중 오류가 발생했습니다.");
    }
}

function closeRestoreModal() {
    const modal = document.getElementById('modal-restore-list');
    if (modal) modal.style.display = 'none';
}






// [script.js] 맨 하단 window.addEventListener('DOMContentLoaded', ...) 교체
window.addEventListener('DOMContentLoaded', async () => {
    initTheme();
    loadAllFromLocal();
    loadGridOrder();
    updateInfoGrid();
    setInterval(updateInfoGrid, 1000);
    fetchRealTimeWeather();
    fetchAirQuality();
    displayMeal();
    renderCalendar();
    fetchNotices();
    setInterval(fetchNotices, 10000);

    // ✨ 자동 로그인 복구 핵심 로직
    ; // 라이브러리 안정화를 위해 2초 후 실행
});

/**
 * 🔒 [1] 지정된 공유 폴더로 암호화 업로드
 */
async function encryptAndUploadToDrive() {
    const password = document.getElementById('backup-password').value;
    if (!password) {
        alert("비밀번호를 입력해주세요!");
        return;
    }

    try {
        const fileName = prompt("백업 파일 이름:", `yuga_${new Date().toISOString().slice(0, 10)}`);
        if (!fileName) return;

        showToast("암호화 및 저장 준비 중...");

        // 데이터 암호화 로직
        const localData = localStorage.getItem('yuga_dashboard_v1');
        const themeData = localStorage.getItem('yuga_dashboard_theme');
        const gridLayout = localStorage.getItem('yuga_grid_layout');

        const rawContent = JSON.stringify({
            data: JSON.parse(localData || '{}'),
            theme: themeData,
            layout: JSON.parse(gridLayout || '{}')
        });
        const encrypted = CryptoJS.AES.encrypt(rawContent, password).toString();

        // 📍 미리 지정한 공유 폴더 ID 사용
        const fileMetadata = {
            'name': fileName + ".enc",
            'parents': [SHARED_FOLDER_ID], // 👈 선생님이 설정한 폴더로 직접 전송
            'mimeType': 'text/plain'
        };

        const blob = new Blob([encrypted], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
        formData.append('file', blob);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + gapi.client.getToken().access_token }),
            body: formData
        });

        if (response.ok) {
            showToast("안전하게 저장되었습니다!");
        } else {
            throw new Error("전송 실패");
        }
    } catch (err) {
        console.error("백업 오류:", err);
        showToast("접근 권한을 확인하세요.");
    }
}

/**
 * 🔒 [암호화 동기화] 설정을 텍스트 코드로 변환
 */
function generateBackupCode() {
    const password = document.getElementById('backup-password').value;
    if (!password) return alert("비밀번호를 입력하세요!");

    try {
        const localData = localStorage.getItem('yuga_dashboard_v1');
        const themeData = localStorage.getItem('yuga_dashboard_theme');

        // 데이터 구조화
        const rawContent = JSON.stringify({
            data: JSON.parse(localData || '{}'),
            theme: themeData,
            exportedAt: new Date().toLocaleString()
        });

        // AES 암호화 실행 (CryptoJS 라이브러리 필요)
        if (typeof CryptoJS === 'undefined') {
            alert("암호화 라이브러리가 로드되지 않았습니다. 인터넷 연결을 확인하세요.");
            return;
        }

        const encrypted = CryptoJS.AES.encrypt(rawContent, password).toString();

        // UI 업데이트
        document.getElementById('encrypted-code-area').value = encrypted;
        document.getElementById('backup-result-area').style.display = 'block';
        document.getElementById('restore-input-area').style.display = 'none';

        // 성공 알림 (showToast가 정의되어 있다면 사용)
        alert("암호화 코드가 생성되었습니다!");
    } catch (e) {
        console.error(e);
        alert("코드 생성 중 오류가 발생했습니다.");
    }
}

function copyEncryptedCode() {
    const area = document.getElementById('encrypted-code-area');
    area.select();
    document.execCommand('copy');
    alert("코드가 복사되었습니다! 카톡이나 메모장에 저장하세요.");
}

function showRestoreInput() {
    document.getElementById('restore-input-area').style.display = 'block';
    document.getElementById('backup-result-area').style.display = 'none';
}

function decryptAndRestore() {
    const password = document.getElementById('backup-password').value;
    const encryptedData = document.getElementById('input-code-area').value.trim();

    if (!password || !encryptedData) return alert("비밀번호와 코드를 모두 입력하세요!");

    try {
        const bytes = CryptoJS.AES.decrypt(encryptedData, password);
        const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);

        if (!decryptedStr) throw new Error("Invalid password");

        const config = JSON.parse(decryptedStr);

        // 로컬 스토리지 복구
        if (config.data) localStorage.setItem('yuga_dashboard_v1', JSON.stringify(config.data));
        if (config.theme) localStorage.setItem('yuga_dashboard_theme', config.theme);

        alert("설정이 성공적으로 복구되었습니다! 페이지를 새로고침합니다.");
        location.reload();
    } catch (err) {
        alert("비밀번호가 틀렸거나 잘못된 코드입니다.");
    }
}

async function encryptAndUploadToSharedDrive() {
    const password = document.getElementById('backup-password').value;
    if (!password) return alert("비밀번호를 입력해주세요!");

    try {
        const fileName = prompt("백업 파일 이름:", `yuga_${new Date().toISOString().slice(0, 10)}`);
        if (!fileName) return;

        showToast("데이터 암호화 중...");

        // 1. 데이터 암호화
        const localData = localStorage.getItem('yuga_dashboard_v1');
        const themeData = localStorage.getItem('yuga_dashboard_theme');
        const rawContent = JSON.stringify({
            data: JSON.parse(localData || '{}'),
            theme: themeData
        });
        const encrypted = CryptoJS.AES.encrypt(rawContent, password).toString();

        // 2. 구글 드라이브 업로드 설정
        const fileMetadata = {
            'name': fileName + ".enc",
            'parents': [SHARED_FOLDER_ID]
        };

        const blob = new Blob([encrypted], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
        formData.append('file', blob);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + gapi.client.getToken().access_token }),
            body: formData
        });

        if (response.ok) {
            showToast("폴더에 안전하게 저장되었습니다!");
        } else {
            throw new Error("전송 실패");
        }
    } catch (err) {
        console.error(err);
        showToast("저장 실패. 권한을 확인하세요.");
    }
}

/**
 * 📂 공유 폴더에서 파일 목록 불러오기
 */
async function loadConfigFromSharedDrive() {
    // 기존에 만드신 복구 리스트 모달을 띄우는 로직
    const listContainer = document.getElementById('restore-file-list');
    document.getElementById('modal-restore-list').style.display = 'flex';
    listContainer.innerHTML = '목록 읽어오는 중...';

    try {
        const response = await gapi.client.drive.files.list({
            q: `'${SHARED_FOLDER_ID}' in parents and trashed = false`,
            fields: 'files(id, name, createdTime)',
            orderBy: 'createdTime desc'
        });

        const files = response.result.files;
        // 목록 렌더링 (기존 함수 활용)
        renderRestoreList(files);
    } catch (err) {
        listContainer.innerHTML = '파일을 불러올 수 없습니다.';
    }
}

// [script.js 하단]
const CLOUD_API_URL = "https://script.google.com/macros/s/AKfycbzRJ7rPYf6i_hL9eW3nqhJRs-OBft7anja0FFKvCswVcmh3pd1w49gmeB5Wdp0Tv_16/exec";

/**
 * 🔒 [저장] 아이디 중복 체크 및 데이터 암호화 저장
 * @param {boolean} isOverlapCheck - true일 경우 중복 무시하고 덮어쓰기
 */
/**
 * 🔒 [저장] 아이디 중복 엄격 체크 버전
 */
/**
 * 🔒 [저장] 아이디 중복 시 비밀번호가 맞으면 업데이트, 틀리면 차단
 */
async function encryptAndSaveToCloud() {
    const id = document.getElementById('save-id').value.trim();
    const pw1 = document.getElementById('save-pw1').value;
    const pw2 = document.getElementById('save-pw2').value;

    if (!id || !pw1) return alert("아이디와 비밀번호를 모두 입력하세요.");
    if (pw1 !== pw2) return alert("비밀번호 재확인이 일치하지 않습니다.");

    showToast("아이디 권한 확인 중...");

    try {
        // 1단계: 기존에 해당 아이디로 저장된 파일이 있는지 목록 확인
        const listRes = await fetch(CLOUD_API_URL, {
            method: 'POST',
            body: JSON.stringify({ mode: 'list', userId: id })
        });
        const files = await listRes.json();

        // 2단계: 파일이 이미 존재한다면 '비밀번호 검증' 절차 수행
        if (files.length > 0) {
            // 2단계: 기존 파일 읽기 알림 (사라지지 않음)
            showToast("기존 데이터를 불러와 본인 확인 중입니다...", 0);
            const fileId = files[0].id;
            
            // 기존 파일 내용을 가져옴
            const readRes = await fetch(CLOUD_API_URL, {
                method: 'POST',
                body: JSON.stringify({ mode: 'read', fileId: fileId })
            });
            const oldEncryptedData = await readRes.text();

            // 입력한 비밀번호로 복호화 시도 (비밀번호 맞는지 확인)
            try {
                const bytes = CryptoJS.AES.decrypt(oldEncryptedData.trim(), pw1);
                const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
                
                if (!decryptedStr) throw new Error("PW_FAIL");
                // 복호화 성공 시, 본인 확인 완료된 것으로 간주하고 진행
            } catch (e) {
                alert(`'${id}'는 이미 다른 사용자가 등록한 아이디입니다.\n본인의 아이디라면 비밀번호를 확인하시고, 아니라면 다른 아이디를 사용해 주세요.`);
                return; // 함수 종료
            }
        }

        // 3단계: (새 아이디이거나 비번 검증 통과 시) 데이터 암호화 및 저장 실행
        showToast("데이터를 안전하게 암호화하여 전송 중입니다...", 0);
        const localData = localStorage.getItem('yuga_dashboard_v1');
        const themeData = localStorage.getItem('yuga_dashboard_theme');
        const rawContent = JSON.stringify({ data: JSON.parse(localData || '{}'), theme: themeData });

        const encrypted = CryptoJS.AES.encrypt(rawContent, pw1).toString();

        const saveRes = await fetch(CLOUD_API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                mode: 'save', 
                userId: id, 
                content: encrypted,
                force: true // 📍 검증을 마쳤으므로 덮어쓰기 허용
            })
        });

        if (await saveRes.text() === "SUCCESS") {
            showToast("성공적으로 업데이트되었습니다! ✅");
            closeBackupModal();
        }
    } catch (e) {
        console.error(e);
        alert("통신 중 오류가 발생했습니다.");
    }
}

/**
 * 📂 [목록] 공유 폴더 내 파일 조회
 */
/**
 * 📂 [목록] 비밀번호 검증 후 공유 폴더 내 파일 조회
 */
async function fetchCloudFileList() {
    const id = document.getElementById('load-id').value.trim();
    const pw = document.getElementById('load-pw').value;

    if (!id || !pw) return alert("아이디와 비밀번호를 모두 입력하세요.");

    const listDiv = document.getElementById('cloud-file-list');
    listDiv.innerHTML = "<div style='text-align:center; padding:10px; font-size:0.8rem;'>보안 검증 및 목록 조회 중...</div>";
    listDiv.style.display = 'block';

    try {
        // 1. 먼저 아이디에 해당하는 파일 목록을 가져옵니다.
        const res = await fetch(CLOUD_API_URL, {
            method: 'POST',
            body: JSON.stringify({ mode: 'list', userId: id })
        });
        const files = await res.json();

        if (files.length === 0) {
            listDiv.innerHTML = "<div style='text-align:center; padding:10px; opacity:0.6; font-size:0.8rem;'>저장된 백업 데이터가 없습니다.</div>";
            return;
        }

        // 2. 🔐 [핵심 보안] 가장 최근 파일을 읽어와서 사용자가 입력한 비번으로 복호화 시도
        const verifyRes = await fetch(CLOUD_API_URL, {
            method: 'POST',
            body: JSON.stringify({ mode: 'read', fileId: files[0].id })
        });
        const encryptedData = await verifyRes.text();

        try {
            const bytes = CryptoJS.AES.decrypt(encryptedData.trim(), pw);
            const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);
            
            // 복호화 결과가 없으면 비번이 틀린 것임
            if (!decryptedStr) throw new Error("AUTH_FAIL");

            // 3. 검증 성공 시에만 인증창을 숨기고 목록을 렌더링합니다.
            document.getElementById('load-auth-area').style.display = 'none';
            
            listDiv.innerHTML = files.map(f => `
                <div class="restore-item" onclick="restoreFromCloud('${f.id}')" style="padding:12px; cursor:pointer; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.85rem; display:flex; justify-content:space-between; align-items:center;">
                    <span>${new Date(f.date).toLocaleString()} 백업본</span>
                    <span class="material-symbols-rounded" style="color:var(--accent);">download</span>
                </div>
            `).join('') + `<button class="btn-cancel" onclick="showStep('step-load')" style="width:100%; margin-top:10px; font-size:0.75rem; border:none; background:none; color:white; cursor:pointer;">↻ 아이디 다시 입력</button>`;
            
            showToast("인증되었습니다. 복구할 파일을 선택하세요.");

        } catch (authError) {
            // 비번이 틀리면 목록을 보여주지 않고 에러 메시지 출력
            listDiv.innerHTML = "<div style='text-align:center; padding:10px; color:#ff4b5c; font-size:0.8rem;'>비밀번호가 일치하지 않아 목록을 볼 수 없습니다.</div>";
        }
    } catch (e) { 
        console.error(e);
        listDiv.innerHTML = "<div style='text-align:center; padding:10px; color:#ff4b5c; font-size:0.8rem;'>조회 실패: 네트워크 상태를 확인하세요.</div>"; 
    }
}

/**
 * 🔓 [복구] 파일 복호화 및 적용
 */
/**
 * 🔓 [복구] 파일 읽기 및 정밀 복호화
 */
async function restoreFromCloud(fileId) {
    const pw = document.getElementById('load-pw').value;
    if (!pw) return alert("복호화를 위해 비밀번호를 입력해주세요.");
    if (!confirm("이 설정으로 복구하시겠습니까? 현재 대시보드 데이터는 모두 교체됩니다.")) return;

    showToast("데이터 복구 시도 중...");

    try {
        // 📍 Failed to fetch 해결: GAS에 'read' 모드로 요청하여 파일 내용을 직접 텍스트로 받음
        const res = await fetch(CLOUD_API_URL, {
            method: 'POST',
            body: JSON.stringify({ mode: 'read', fileId: fileId })
        });

        if (!res.ok) throw new Error("서버 연결 실패");

        const encryptedData = await res.text();

        // AES 복호화 시도
        const bytes = CryptoJS.AES.decrypt(encryptedData.trim(), pw);
        const decryptedStr = bytes.toString(CryptoJS.enc.Utf8);

        if (!decryptedStr) {
            throw new Error("비밀번호가 틀렸거나 데이터가 손상되었습니다.");
        }

        const decrypted = JSON.parse(decryptedStr);

        // 로컬 스토리지에 복구 데이터 적용
        if (decrypted.data) localStorage.setItem('yuga_dashboard_v1', JSON.stringify(decrypted.data));
        if (decrypted.theme) localStorage.setItem('yuga_dashboard_theme', decrypted.theme);

        showToast("성공적으로 복구되었습니다! ✅");
        location.reload();

    } catch (e) {
        console.error("복구 에러 상세:", e);
        alert("복구 실패: " + e.message);
    }
}
/**
 * 🍞 토스트 팝업 표시 함수 (지속 시간 조절 가능)
 * @param {string} message - 표시할 내용
 * @param {number} duration - 표시 시간(ms). 0을 넣으면 수동으로 지울 때까지 유지.
 */
function showToast(message, duration = 2500) {
    const container = document.getElementById('toast-container');
    
    // 📍 기존에 떠 있는 토스트가 있다면 즉시 제거 (메시지 교체 효과)
    container.innerHTML = ''; 

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="material-symbols-rounded" style="font-size:1.2rem;">sync</span> ${message}`;
    
    container.appendChild(toast);
    
    // 📍 duration이 0보다 클 때만 자동으로 삭제
    if (duration > 0) {
        setTimeout(() => {
            if (toast && toast.parentNode === container) {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 500);
            }
        }, duration);
    }
    
    // 다음 단계에서 제어할 수 있도록 요소 반환
    return toast;
}

/**
 * 🔄 대시보드 새로고침 기능
 */
function refreshDashboard() {
    const icon = document.getElementById('refresh-icon');
    
    // 1. 아이콘 회전 애니메이션 적용
    if (icon) {
        icon.style.transition = "transform 0.5s ease";
        icon.style.transform = "rotate(360deg)";
    }

    // 2. 토스트 메시지 표시
    showToast("데이터를 새로고침하고 있습니다...", 1000);

    // 3. 0.8초 후 페이지 새로고침 (애니메이션을 보여주기 위함)
    setTimeout(() => {
        location.reload();
    }, 800);
}