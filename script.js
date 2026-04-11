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
        <div class="d-info"><span class="d-label">${title}</span><span class="d-date">${dateInput.substring(0,4)}-${dateInput.substring(4,6)}-${dateInput.substring(6,8)}</span></div>
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
function closeNoticeModal() { document.getElementById('modal-notice').style.display = 'none'; }

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
    box.style.display = (box.style.display === 'none') ? 'block' : 'none';
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
        dustWidget.innerHTML = `<div class="air-header"><span class="material-symbols-rounded" style="font-size:2rem;">${icons[gradeNum]||"help"}</span><div class="air-status-text"><span class="air-label">미세먼지</span><span class="air-grade-val">${grades[gradeNum]||"정보없음"}</span></div></div><div class="air-details-grid"><div class="air-item"><div class="air-item-label">미세</div><div class="air-item-val">${item.pm10Value}㎍</div></div><div class="air-item"><div class="air-item-label">초미세</div><div class="air-item-val">${item.pm25Value}㎍</div></div></div>`;
    } catch (e) { console.error(e); }
}

async function displayMeal() {
    const ymd = currentMealDate.getFullYear() + String(currentMealDate.getMonth()+1).padStart(2,'0') + String(currentMealDate.getDate()).padStart(2,'0');
    document.getElementById('meal-display-date').innerText = `${currentMealDate.getFullYear()}-${String(currentMealDate.getMonth()+1).padStart(2,'0')}-${String(currentMealDate.getDate()).padStart(2,'0')}`;
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
 * [9] 백업/복구 및 편집 모드 (위치 저장 기능 제외 버전)
 */
function openBackupModal() { document.getElementById('modal-backup').style.display = 'flex'; }
function closeBackupModal() { document.getElementById('modal-backup').style.display = 'none'; }

function exportSettingsToFile() {
    const config = { data: JSON.parse(localStorage.getItem('yuga_dashboard_v1')), theme: localStorage.getItem('yuga_dashboard_theme'), exportedAt: new Date().toLocaleString() };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `yuga_backup_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
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

/**
 * [10] 실행
 */
window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadAllFromLocal(); // 📍 핵심: 로드 시 데이터 복구
    loadGridOrder();    // [중요] 그 다음 저장된 위치로 카드 옮기기
    updateInfoGrid();
    setInterval(updateInfoGrid, 1000);
    fetchRealTimeWeather();
    fetchAirQuality();
    displayMeal();
    renderCalendar();
    fetchNotices();
    setInterval(fetchNotices, 10000);
});