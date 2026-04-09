/**

 * [1] 글로벌 변수 및 설정

 */

let currentMode = null;  

let currentTarget = null;

const SPECIAL_LIST = ['영어1', '영어2', '음악', '체육', '강사'];

let currentMealDate = new Date();



/**

 * [2] 통합 데이터 저장 시스템 (LocalStorage 1단계)

 */



// 💾 모든 개인 설정 저장 (퀵런처, 디데이, 개인일정)

function saveAllToLocal() {

    const data = {

        launchers: [],

        ddays: [],

        calendarEvents: []

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



   



    localStorage.setItem('yuga_dashboard_v1', JSON.stringify(data));

}



// 📂 저장된 데이터 불러오기 및 화면 복원 (수정본)

function loadAllFromLocal() {

    const rawData = localStorage.getItem('yuga_dashboard_v1');



// 📍 [수정] 기본으로 넣고 싶은 사이트 리스트를 여기에 적으세요!

    const DEFAULT_LAUNCHERS = [

        { title: '업무포털', url: 'https://dge.eduptl.kr' },

        { title: '학교홈피', url: 'https://yuga.dge.es.kr' } // 예시 주소입니다

    ];



    let data;

    if (!rawData) {

        // 데이터가 아예 없으면 기본 리스트를 사용

        data = { launchers: DEFAULT_LAUNCHERS, ddays: [], calendarEvents: [] };

    } else {

        data = JSON.parse(rawData);

        // 만약 저장된 퀵런처가 하나도 없다면 기본 리스트를 넣어줌

        if (!data.launchers || data.launchers.length === 0) {

            data.launchers = DEFAULT_LAUNCHERS;

        }

    }



    // 🚀 퀵런처 복원 및 출력

    if (data.launchers) {

        const container = document.getElementById('launcher-container');

        if (container) {

            container.innerHTML = '';

            data.launchers.forEach(l => renderLauncherItem(l.title, l.url));

        }

    }



    // ⏳ 디데이 복원 (기존 코드 유지)

    if (data.ddays) {

        const container = document.getElementById('dday-container');

        if (container) {

            container.innerHTML = '';

            data.ddays.forEach(d => renderDDayItem(d.title, d.date));

        }

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

    saveAllToLocal(); // 저장

   

    document.getElementById('launcher-title').value = '';

    document.getElementById('launcher-url').value = '';

    toggleLauncherInput();

}



/**

 * [ ] 캘린더 핵심 로직 (나이스 연동 + 개인일정 + 하단 리스트)

 */

let viewDate = new Date(); // 달력 기준 날짜

const ATPT_CODE = 'D10';   // 대구교육청

const SCHUL_CODE = '7281024'; // 유가초등학교



// 1. 나이스 학사일정 호출 함수

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



// 2. 달력 및 하단 리스트 렌더링

async function renderCalendar() {

    const year = viewDate.getFullYear();

    const month = viewDate.getMonth();

   

    // 월 타이틀 업데이트 (2026년 4월 등)

    const monthTitle = document.getElementById('calendar-month-year');

    if (monthTitle) monthTitle.innerHTML = `<span class="material-symbols-rounded">calendar_month</span> ${year}년 ${month + 1}월`;



    const scheduleData = await fetchSchoolSchedule(year, month);

    const grid = document.getElementById('calendar-grid');

    if (!grid) return;



    // 요일 헤더 유지하며 초기화

    const headers = grid.querySelectorAll('.day-header');

    grid.innerHTML = '';

    headers.forEach(h => grid.appendChild(h));



    const firstDay = new Date(year, month, 1).getDay();

    const lastDate = new Date(year, month + 1, 0).getDate();

    let allMonthEvents = []; // 하단 리스트용 배열



    // 빈칸 생성

    for (let i = 0; i < firstDay; i++) {

        grid.appendChild(document.createElement('div')).className = 'day empty';

    }



    // 날짜 칸 생성 루프

    for (let i = 1; i <= lastDate; i++) {

        const dayDiv = document.createElement('div');

        dayDiv.className = 'day';

        dayDiv.innerText = i;



        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

        const dateStr = dateKey.replace(/-/g, '');

        const dayOfWeek = new Date(year, month, i).getDay();

       

        // 데이터 매칭 (나이스 + 개인)

        let dayPlan = scheduleData.find(d => d.AA_YMD === dateStr);

        if (dayPlan && dayPlan.EVENT_NM === "토요휴업일") dayPlan = null;

        const personalEvent = getPersonalEvent(dateKey);



        // 주말 및 공휴일 색상 처리

        if (dayOfWeek === 0 || (dayPlan && dayPlan.SBTR_DD_SC_NM === "휴업일")) {

            dayDiv.style.color = "#ff6b6b";

        } else if (dayOfWeek === 6) {

            dayDiv.style.color = "#4dabf7";

        }



        // 오늘 날짜 표시

        const today = new Date();

        if(year === today.getFullYear() && month === today.getMonth() && i === today.getDate()) {

            dayDiv.classList.add('active');

        }



        // 이벤트 표시 (점 + 툴팁 + 리스트 데이터 수집)

        if (dayPlan || personalEvent) {

            dayDiv.classList.add('event');

            const tip = [];

            if (dayPlan) {

                tip.push(`[학교] ${dayPlan.EVENT_NM}`);

                allMonthEvents.push({ day: i, desc: dayPlan.EVENT_NM, type: 'school' });

            }

            if (personalEvent) {

                tip.push(`[개인] ${personalEvent.desc}`);

                allMonthEvents.push({ day: i, desc: personalEvent.desc, type: 'personal' });

            }

            dayDiv.title = tip.join('\n');

        }



        dayDiv.onclick = () => openEventModal(dateKey);

        grid.appendChild(dayDiv);

    }

   

    // 📍 하단 리스트 업데이트 함수 호출

    updateMonthlyEventList(allMonthEvents, month + 1);

}

// 3. 하단 일정 리스트 그려주는 함수

function updateMonthlyEventList(events, currentMonth) {

    const listContainer = document.getElementById('monthly-event-list');

    if (!listContainer) return;

    listContainer.innerHTML = '';

   

    events.sort((a, b) => a.day - b.day); // 날짜순 정렬



    if (events.length === 0) {

        listContainer.innerHTML = '<div class="event-row" style="justify-content:center; opacity:0.5; font-size:0.8rem; padding:10px;">이번 달 일정이 없습니다.</div>';

    } else {

        events.forEach(ev => {

            const row = document.createElement('div');

            row.className = 'event-row';

            const icon = ev.type === 'personal' ? '📌 ' : '';

            row.innerHTML = `

                <span class="event-date">${currentMonth}/${ev.day}</span>

                <span class="event-desc">${icon}${ev.desc}</span>

            `;

            listContainer.appendChild(row);

        });

    }

}



// [2] 월 이동 함수

function changeMonth(offset) {

    viewDate.setMonth(viewDate.getMonth() + offset);

    renderCalendar();

}



// [3] 일정 여부 확인

function hasEvent(dateKey) {

    const rawData = localStorage.getItem('yuga_dashboard_v1');

    if (!rawData) return false;

    const data = JSON.parse(rawData);

    return data.calendarEvents?.some(e => e.date === dateKey);

}

// 4. 개인 일정 보조 함수 (LocalStorage 연동)

function getPersonalEvent(dateKey) {

    const data = JSON.parse(localStorage.getItem('yuga_dashboard_v1') || '{"calendarEvents":[]}');

    return data.calendarEvents?.find(e => e.date === dateKey);

}

// [4] 날짜 클릭 시 일정 관리

let selectedDateKey = null; // 현재 선택된 날짜 저장용



// [1] 모달 열기

function openEventModal(dateKey) {

    selectedDateKey = dateKey;

    const existingEvent = getPersonalEvent(dateKey);

   

    document.getElementById('event-modal-title').innerText = `${dateKey} 일정`;

    const input = document.getElementById('input-event-desc');

    const delBtn = document.getElementById('btn-del-event');

   

    input.value = existingEvent ? existingEvent.desc : "";

    delBtn.style.display = existingEvent ? "block" : "none"; // 일정이 있을 때만 삭제 버튼 노출

   

    document.getElementById('modal-event').style.display = 'flex';

    input.focus();

}



// [2] 모달 닫기

function closeEventModal() {

    document.getElementById('modal-event').style.display = 'none';

}



// [3] 저장 버튼 로직

document.getElementById('btn-save-event').onclick = function() {

    const desc = document.getElementById('input-event-desc').value.trim();

    if (!desc) return alert("내용을 입력해주세요!");

   

    updateEventData(selectedDateKey, desc);

    closeEventModal();

    renderCalendar();

};



// [4] 삭제 버튼 로직

document.getElementById('btn-del-event').onclick = function() {

    if(confirm("이 일정을 삭제하시겠습니까?")) {

        updateEventData(selectedDateKey, ""); // 빈 값으로 업데이트하여 삭제

        closeEventModal();

        renderCalendar();

    }

};



// [저장/조회 보조 함수들]

function getEvent(dateKey) {

    const data = JSON.parse(localStorage.getItem('yuga_dashboard_v1') || '{"calendarEvents":[]}');

    return data.calendarEvents.find(e => e.date === dateKey)?.desc;

}



function updateEventData(dateKey, desc) {

    let data = JSON.parse(localStorage.getItem('yuga_dashboard_v1') || '{"calendarEvents":[]}');

    if (!data.calendarEvents) data.calendarEvents = [];

    data.calendarEvents = data.calendarEvents.filter(e => e.date !== dateKey);

    if (desc !== "") data.calendarEvents.push({ date: dateKey, desc: desc });

    localStorage.setItem('yuga_dashboard_v1', JSON.stringify(data));

}





/**

 * [4] 디데이 기능

 */

function toggleDDayInput() {

    const inputField = document.getElementById('inline-dday-input');

    if (inputField.style.display !== 'none') {

        document.getElementById('dday-title').value = "";

        document.getElementById('dday-target-date').value = "";

    }

    inputField.style.display = (inputField.style.display === 'none') ? 'block' : 'none';

}



function calculateDDay(targetDate) {

    const today = new Date();

    today.setHours(0, 0, 0, 0);

    const formattedDate = `${targetDate.substring(0, 4)}-${targetDate.substring(4, 6)}-${targetDate.substring(6, 8)}`;

    const target = new Date(formattedDate);

    const diff = target - today;

    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    return days === 0 ? "D-Day" : (days > 0 ? `D-${days}` : `D+${Math.abs(days)}`);

}



function renderDDayItem(title, dateInput) {

    const formattedDate = `${dateInput.substring(0, 4)}-${dateInput.substring(4, 6)}-${dateInput.substring(6, 8)}`;

    const dDayText = calculateDDay(dateInput);

    const container = document.getElementById('dday-container');

   

    const newItem = document.createElement('div');

    newItem.className = 'd-day-item';

    newItem.innerHTML = `

        <div class="d-info">

            <span class="d-label">${title}</span>

            <span class="d-date">${formattedDate}</span>

        </div>

        <div class="d-right">

            <span class="d-count">${dDayText}</span>

            <button class="btn-del-dday" onclick="this.parentElement.parentElement.remove(); saveAllToLocal();">

                <span class="material-symbols-rounded">delete</span>

            </button>

        </div>

    `;

    container.prepend(newItem);

}



function addNewDDay() {

    const title = document.getElementById('dday-title').value;

    const dateInput = document.getElementById('dday-target-date').value;

    if (dateInput.length !== 8 || !title) return alert("입력값을 확인하세요!");



    renderDDayItem(title, dateInput);

    saveAllToLocal(); // 저장

    toggleDDayInput();

}



/**

 * [5] 시간표 기능 (구글 시트 연동)

 */

/**

 * [5] 시간표 주차 자동 계산 (정밀 보정 버전)

 */

function getTargetSheetName() {

    const now = new Date();

    const day = now.getDay(); // 0(일)~6(토)

   

    // 📍 오늘 날짜 객체에서 요일 보정값을 빼서 이번 주 월요일 객체를 직접 만듭니다.

    // 일요일(0)이면 6일을 빼고, 월~토(1~6)이면 (요일-1)일을 뺍니다.

    const gap = (day === 0 ? 6 : day - 1);

    const monday = new Date(now);

    monday.setDate(now.getDate() - gap);

   

    const m = monday.getMonth() + 1;

    const d = monday.getDate();



    // 부장님 시트 형식 '4.6.' 반환

    const sheetName = `${m}.${d}.`;

    console.log("📅 [디버깅] 계산된 월요일 날짜:", sheetName);

   

    return sheetName;

}



// [1] 선택 시 이름 표시 로직 추가

async function selectView(mode, value, btn) {

    document.querySelectorAll('.chip, .m-chip').forEach(chip => chip.classList.remove('active'));

    if (btn) btn.classList.add('active');

   

    currentMode = mode;

    currentTarget = value;



    // 📍 선택된 대상(예: 6-1, 영어2 등)을 제목 옆에 표시

    const displayTarget = document.getElementById('selected-target-name');

    if (displayTarget) {

        displayTarget.innerText = `(${value})`;

    }



    await refreshTimetableData();

}



// 학년공지사항-------------------------------------------------------------

const GAS_APP_URL = "https://script.google.com/macros/s/AKfycbwfxVR_NWeP5Ekh74dM_ib7Lhd78to0ijswqcyeapK-AelSfGz8YdS96d1Z5uyUyxHv/exec";



// [1] 공지사항 불러오기 (doGet 활용)

// [1] 공지사항 불러오기 (아이콘 제거 버전)

async function fetchNotices() {

    try {

        const response = await fetch(GAS_APP_URL);

        const notices = await response.json();

        const container = document.getElementById('notice-display-area');

       

        if (notices.length === 0) {

            container.innerHTML = "<p class='empty-text'>등록된 공지가 없습니다.</p>";

            return;

        }



        // 아이콘(span)을 제거하고 공지 내용만 출력

        container.innerHTML = notices.map(msg => `

            <div class="notice-item">

                <p class="notice-text">${msg}</p>

            </div>

        `).join('');

    } catch (e) {

        console.error("공지사항 로드 실패:", e);

    }

}



/* --- 공지사항 전송 함수 (딜레이 제거 및 알림창 삭제 버전) --- */

async function submitNotice() {

    const textInput = document.getElementById('input-notice-text');

    const text = textInput.value.trim();

    if (!text) return;



    // 1. 공지사항 리스트 영역을 찾습니다.

    const container = document.getElementById('notice-display-area');

   

    // 2. 입력창을 비우고 모달을 즉시 닫습니다.

    textInput.value = '';

    closeNoticeModal();



    // 3. 리스트 영역에 "기록 중" 메시지를 즉시 표시합니다.

    // 기존 내용을 지우고 시각적으로 피드백을 줍니다.

    container.innerHTML = `

        <div class="notice-waiting">

            <span class="material-symbols-rounded loading-spinner">sync</span>

            <p>공지사항을 기록 중입니다...</p>

        </div>

    `;



    try {

        // 4. 서버(GAS)로 데이터 전송

        const response = await fetch(GAS_APP_URL, {

            method: 'POST',

            body: text

        });



        if (response.ok) {

            // 5. 기록이 완료되면 목록을 다시 불러와서 메시지를 최신 데이터로 교체합니다.

            fetchNotices();

        }

    } catch (e) {

        console.error("전송 중 오류 발생:", e);

        container.innerHTML = `<p class="error-text">기록에 실패했습니다. 다시 시도해주세요.</p>`;

    }

}



// 모달 제어 함수

function openNoticeModal() { document.getElementById('modal-notice').style.display = 'flex'; }

function closeNoticeModal() { document.getElementById('modal-notice').style.display = 'none'; }







// 🔄 1. 데이터를 가져와서 모든 테이블에 뿌려주는 메인 함수



/* --- 시간표 로딩 최적화 버전 --- */

let cachedSheetData = null; // 시트 데이터를 임시 저장할 변수
let lastSheetName = "";     // 마지막으로 불러온 시트 이름

async function refreshTimetableData() {
    if (!currentMode || !currentTarget) return;

    // UI 즉시 전환 및 로딩 메시지 표시
    document.getElementById('initial-selector').style.display = 'none';
    document.getElementById('view-mini-weekly').style.display = 'block';
    
    // 로딩 메시지 삽입 (사용자에게 피드백 제공)
    const loadingHtml = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-dim);">⏳ 데이터를 읽어들이는 중...</td></tr>`;
    document.getElementById('mini-weekly-tbody').innerHTML = loadingHtml;
    document.getElementById('weekly-tbody').innerHTML = loadingHtml;

    const sheetName = getTargetSheetName();
    const SPREADSHEET_ID = '1i13Yl1giTW1-LW7OQHxg7uUu11NVQnKQlf-PJgViOnE';
    const FETCH_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

    try {
        let rows;

        // 캐시 데이터 확인
        if (cachedSheetData && lastSheetName === sheetName) {
            rows = cachedSheetData;
        } else {
            // 실제 네트워크 호출 시 약간의 지연을 시뮬레이션하거나 체감하기 위해 
            // 데이터를 불러오는 동안 로딩 메시지가 유지됩니다.
            const res = await fetch(FETCH_URL);
            const csvData = await res.text();
            rows = csvData.split('\n').map(row => 
                row.split(',').map(cell => cell.replace(/^"(.*)"$/, '$1').trim())
            );
            cachedSheetData = rows;
            lastSheetName = sheetName;
        }

        // 데이터 가공 (기존과 동일)
        let timetableData = Array.from({ length: 7 }, () => Array(5).fill('-'));
        rows.forEach((row, rIdx) => {
            if (rIdx < 1) return;
            const period = parseInt(row[0]);
            if (!period || period > 7) return;
            
            for (let day = 0; day < 5; day++) {
                const startCol = 1 + (day * 5);
                if (currentMode === 'class') {
                    for (let sIdx = 0; sIdx < 5; sIdx++) {
                        if (row[startCol + sIdx] === currentTarget) {
                            timetableData[period - 1][day] = SPECIAL_LIST[sIdx];
                        }
                    }
                } else {
                    const subIdx = SPECIAL_LIST.indexOf(currentTarget);
                    timetableData[period - 1][day] = row[startCol + subIdx] || '-';
                }
            }
        });

        // 결과 렌더링 (로딩 메시지가 실제 데이터로 교체됨)
        renderMiniWeeklyTable(timetableData);
        renderWeeklyTable(timetableData);
        
        if(typeof highlightCurrentPeriod === 'function') highlightCurrentPeriod();

    } catch (e) {
        console.error("로드 실패:", e);
        const errorHtml = `<tr><td colspan="6" style="text-align:center; color:red;">❌ 데이터를 불러오지 못했습니다.</td></tr>`;
        document.getElementById('mini-weekly-tbody').innerHTML = errorHtml;
        document.getElementById('weekly-tbody').innerHTML = errorHtml;
    }
}



function renderTodayTable(data) {

    const tableBody = document.getElementById('today-timetable-table');

    let dayIdx = new Date().getDay() - 1;

    if (dayIdx < 0 || dayIdx > 4) dayIdx = 0;

    let html = '';

    for (let i = 0; i < 6; i++) {

        const subject = data[i][dayIdx];

        const isSpecial = SPECIAL_LIST.includes(subject);

        const cellStyle = isSpecial ? 'class="special"' : '';

        const displayText = (isSpecial && currentMode === 'class') ? `${subject}(전담)` : subject;

        html += `<tr><th>${i + 1}교시</th><td ${cellStyle}>${displayText === '-' ? '' : displayText}</td></tr>`;

    }

    tableBody.innerHTML = html;

}



// 📅 대시보드용 미니 주간 시간표 출력 함수

function renderMiniWeeklyTable(data) {

    const tbody = document.getElementById('mini-weekly-tbody');

    if (!tbody) return;



    let html = '';

    // 유가초 일과에 맞춰 6교시 혹은 7교시까지 출력 가능 (i < 7 설정)

    for (let i = 0; i < 6; i++) {

        html += `<tr><th>${i + 1}</th>`;

        for (let j = 0; j < 5; j++) {

            const cell = data[i][j];

            const displayValue = (cell === '담임' || cell === '-' || !cell) ? "" : cell;

           

            // 전담 과목 강조 (노란색 계열)

            const isSpecial = SPECIAL_LIST.includes(cell);

            const tdStyle = isSpecial ? 'style="color:#ffcc00; font-weight:bold;"' : '';

           

            html += `<td ${tdStyle}>${displayValue}</td>`;

        }

        html += `</tr>`;

    }

    tbody.innerHTML = html;

}

// [script.js 추가]

/**

 * 🔄 새로고침 없이 시간표 선택 화면으로 돌아가기

 */

// [2] 다른 학반 선택하기(초기화) 시 텍스트 제거

function resetTimetableSelection() {

    const miniWeeklyView = document.getElementById('view-mini-weekly');

    if (miniWeeklyView) miniWeeklyView.style.display = 'none';



    const initialSelector = document.getElementById('initial-selector');

    if (initialSelector) initialSelector.style.display = 'block';



    document.querySelectorAll('.mini-chips .m-chip').forEach(chip => {

        chip.classList.remove('active');

    });



    // 📍 표시되었던 (6-1) 같은 텍스트 제거

    const displayTarget = document.getElementById('selected-target-name');

    if (displayTarget) displayTarget.innerText = "";



    currentMode = null;

    currentTarget = null;

}



function renderWeeklyTable(data) {

    const tbody = document.getElementById('weekly-tbody');

    let html = '';

    data.forEach((row, i) => {

        html += `<tr><th>${i + 1}</th>`;

        row.forEach(cell => {

            const isSpecial = SPECIAL_LIST.includes(cell);

            const displayText = (cell === '담임' || cell === '-') ? "" : cell;

            const specialClass = isSpecial ? 'class="special"' : '';

            html += `<td ${specialClass}>${displayText}</td>`;

        });

        html += `</tr>`;

    });

    tbody.innerHTML = html;

}



function switchView(viewName, btn) {

    document.getElementById('view-today').style.display = (viewName === 'today') ? 'block' : 'none';

    document.getElementById('view-weekly').style.display = (viewName === 'weekly') ? 'block' : 'none';

    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));

    btn.classList.add('active');

}



function highlightCurrentPeriod() {

    const now = new Date();

    const day = now.getDay();

    if (day === 0 || day === 6) return;

    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const commonTime = [

        { p: 1, s: '08:50', e: '09:30' }, { p: 2, s: '09:35', e: '10:15' },

        { p: 3, s: '10:25', e: '11:05' }, { p: 4, s: '11:10', e: '11:50' },

        { p: 5, s: '12:00', e: '12:40' }, { p: 6, s: '13:40', e: '14:20' }

    ];

    let activeTime = (day === 3) ? commonTime.slice(0, 5) : commonTime; // 수요일 간소화 예시

    let currentP = activeTime.find(t => currentTimeStr >= t.s && currentTimeStr <= t.e)?.p;



    document.querySelectorAll('tr.current-period').forEach(el => el.classList.remove('current-period'));

    if (currentP) {

        const rows = document.querySelectorAll('#today-timetable-table tr, .mini-weekly-table tbody tr, #weekly-tbody tr');

        rows.forEach(row => { if(row.innerText.startsWith(currentP)) row.classList.add('current-period'); });

    }

}

/* --- 투두리스트 기능 로직 ---------------------------------------------- */



function toggleTodoInput() {

    const box = document.getElementById('todo-input-box');

    box.style.display = (box.style.display === 'none') ? 'block' : 'none';

    if(box.style.display === 'block') document.getElementById('todo-text').focus();

}



function addTodo() {

    const input = document.getElementById('todo-text');

    const text = input.value.trim();

    if (!text) return;



    renderTodoItem(text, false);

    input.value = '';

    saveAllToLocal();

}



function renderTodoItem(text, isCompleted) {

    const container = document.getElementById('todo-container');

    const item = document.createElement('div');

    item.className = `todo-item ${isCompleted ? 'completed' : ''}`;

   

    item.innerHTML = `

        <div class="todo-item-left" onclick="toggleTodoStatus(this)">

            <span class="material-symbols-rounded check-icon" style="font-size:1.2rem;">

                ${isCompleted ? 'check_box' : 'check_box_outline_blank'}

            </span>

            <span class="todo-content">${text}</span>

        </div>

        <span class="material-symbols-rounded btn-del-todo" onclick="this.parentElement.remove(); saveAllToLocal();">delete</span>

    `;

    container.prepend(item);

}



function toggleTodoStatus(el) {

    const item = el.parentElement;

    item.classList.toggle('completed');

    const icon = el.querySelector('.check-icon');

    icon.innerText = item.classList.contains('completed') ? 'check_box' : 'check_box_outline_blank';

    saveAllToLocal();

}



// 💾 기존 saveAllToLocal 함수에 투두 데이터 추가

function saveAllToLocal() {

    const data = JSON.parse(localStorage.getItem('yuga_dashboard_v1') || '{"launchers":[], "ddays":[], "calendarEvents":[]}');

   

    data.todos = [];

    document.querySelectorAll('#todo-container .todo-item').forEach(item => {

        data.todos.push({

            text: item.querySelector('.todo-content').innerText,

            completed: item.classList.contains('completed')

        });

    });



    localStorage.setItem('yuga_dashboard_v1', JSON.stringify(data));

}







/**

 * [6] 정보 그리드 (시계, 날씨, 미세먼지)

 */

function updateInfoGrid() {

    const now = new Date();

    const week = ['일', '월', '화', '수', '목', '금', '토'];

   

    // HTML에 해당 ID가 있는지 꼭 확인하세요!

    const dateEl = document.getElementById('info-date');

    const clockEl = document.getElementById('info-clock');



    if (dateEl) {

        dateEl.innerText = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 (${week[now.getDay()]})`;

    }

   

    if (clockEl) {

        const h = String(now.getHours()).padStart(2, '0');

        const m = String(now.getMinutes()).padStart(2, '0');

        const s = String(now.getSeconds()).padStart(2, '0');

        clockEl.innerHTML = `<span class="clock-main">${h}:${m}</span><small class="clock-seconds">:${s}</small>`;

    }

}



async function fetchRealTimeWeather() {

    try {

        const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=35.7726&lon=128.4691&appid=2dff9b605180bb798f6ac365483d2ef8&units=metric&lang=kr`);

        const data = await res.json();

        if (data.main) {

            document.getElementById('info-temp').innerText = `${Math.round(data.main.temp)}°C`;

            const iconEl = document.getElementById('info-weather-icon');

            const code = data.weather[0].icon;

            iconEl.innerText = code.includes('01') ? 'wb_sunny' : (code.includes('02') ? 'partly_cloudy_day' : 'cloud');

        }

    } catch (e) { console.error(e); }

}



/* --- 미세먼지 업데이트 함수 (제안 1 반영) --- */

/* --- 미세먼지 업데이트 함수 (3단 세로 배열 버전) --- */

async function fetchAirQuality() {

    const dustWidget = document.getElementById('info-dust');

    if (!dustWidget) return;



    try {

        const res = await fetch(`https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty?stationName=${encodeURIComponent('유가읍')}&dataTerm=daily&ver=1.0&returnType=json&serviceKey=41130df3a53739396fffc665e1095269d1833f384cb922f4cae318b3f1f2554e`);

        const data = await res.json();

        const item = data.response.body.items[0];



        const gradeNum = Math.max(Number(item.pm10Grade), Number(item.pm25Grade));

        const grades = ["", "좋음", "보통", "나쁨", "매우나쁨"];

        const icons = ["", "sentiment_very_satisfied", "sentiment_satisfied", "sentiment_dissatisfied", "sick"];

       

        const status = grades[gradeNum] || "정보없음";

        const iconName = icons[gradeNum] || "help";



        dustWidget.setAttribute('data-grade', status);



        // 요청하신 대로 각 요소를 한 줄씩 배치한 구조

        dustWidget.innerHTML = `

            <div class="air-header">

                <div class="air-icon-box">

                    <span class="material-symbols-rounded" style="font-size: 2rem;">${iconName}</span>

                </div>

                <div class="air-status-text">

                    <span class="air-label">미세먼지</span>

                    <span class="air-grade-val">${status}</span>

                </div>

            </div>

           

            <div class="air-details-grid">

                <div class="air-item">

                    <div class="air-item-label">미세</div>

                    <div class="air-item-val">${item.pm10Value}<span class="air-unit">㎍</span></div>

                </div>

                <div class="air-item">

                    <div class="air-item-label">초미세</div>

                    <div class="air-item-val">${item.pm25Value}<span class="air-unit">㎍</span></div>

                </div>

            </div>

        `;

    } catch (e) {

        console.error("미세먼지 로드 실패:", e);

    }

}



/**

 * [7] 급식 기능

 */

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



function changeMealDate(offset) {

    currentMealDate.setDate(currentMealDate.getDate() + offset);

    displayMeal();

}



// 설정 패널

// 전체 데이터 새로고침

function refreshAllData() {

    // 버튼 회전 애니메이션 추가 (시각적 피드백)

    const syncBtn = document.querySelector('button[title="전체 데이터 동기화"] span');

    syncBtn.classList.add('loading-spinner');

   

    // 각 기능별 fetch 함수들 호출

    Promise.all([

        fetchNotices(),

        fetchRealTimeWeather(),

        fetchAirQuality(),

        displayMeal(),

        renderCalendar()

    ]).then(() => {

        setTimeout(() => syncBtn.classList.remove('loading-spinner'), 800);

    });

}



/* script.js - 테마 전환 로직 */



const themes = ['dark', 'navy', 'forest', 'pink'];



function toggleTheme() {

    // 1. 현재 테마 확인 (없으면 dark)

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

   

    // 2. 다음 테마 인덱스 계산

    let nextIndex = (themes.indexOf(currentTheme) + 1) % themes.length;

    const nextTheme = themes[nextIndex];



    // 3. HTML 태그에 테마 적용

    document.documentElement.setAttribute('data-theme', nextTheme);

   

    // 4. 로컬 스토리지에 저장 (새로고침해도 유지)

    localStorage.setItem('yuga_dashboard_theme', nextTheme);

   

    // 시각적 피드백 (아이콘 살짝 흔들기)

    const themeBtn = document.querySelector('button[onclick="toggleTheme()"] span');

    if(themeBtn) {

        themeBtn.style.transform = 'rotate(180deg)';

        setTimeout(() => themeBtn.style.transform = 'rotate(0deg)', 300);

    }

}



// 초기 로드 시 저장된 테마 적용

function initTheme() {

    const savedTheme = localStorage.getItem('yuga_dashboard_theme') || 'dark';

    document.documentElement.setAttribute('data-theme', savedTheme);

}





/* --- 구글 드라이브 백업 시스템 --- */



const CLIENT_ID = '705674729221-3m4887vatqd8qpbu0dd8ucpsqotj5l3q.apps.googleusercontent.com'; // 구글 클라우드 콘솔에서 발급
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_NAME = "대시보드_설정";
const FILE_NAME = "yuga_config.json";

let tokenClient;
let accessToken = null;




function openBackupModal() {

    document.getElementById('modal-backup').style.display = 'flex';

}



function closeBackupModal() {

    document.getElementById('modal-backup').style.display = 'none';

}

/* --- 구글 API 인증 및 토큰 관리 --- */







// [1] 구글 인증 초기화 (변수 할당 수정 완료)
function initGoogleAuth() {
    if (typeof google === 'undefined') return;
    
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
            if (response.access_token) {
                accessToken = response.access_token;
                
                // [수정] 로그인 성공 시 UI 전환을 확실하게 처리
                document.getElementById('auth-status-box').style.display = 'none';
                document.getElementById('backup-action-box').style.display = 'block';
                
                // 이메일 안내 텍스트 업데이트
                const emailSpan = document.getElementById('user-email');
                if(emailSpan) emailSpan.innerText = "인증 완료! ";
                
                console.log("구글 인증 성공");
            }
        },
    });
}
// 2. 로그인 버튼 클릭 시 실행

function handleGoogleSignIn() {
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

// [2] 메인 업로드 로직 (누락 함수들 포함)
async function uploadDataToDrive() {
    const syncBtn = document.querySelector('.btn-primary-save');
    if(!accessToken) return alert("로그인이 필요합니다.");

    syncBtn.innerText = "저장 중...";
    syncBtn.disabled = true;

    try {
        let folderId = await findOrCreateFolder(FOLDER_NAME);
        const localData = localStorage.getItem('yuga_dashboard_v1') || '{}';
        const themeData = localStorage.getItem('yuga_dashboard_theme') || 'dark';
        
        const content = JSON.stringify({
            data: JSON.parse(localData),
            theme: themeData,
            updatedAt: new Date().toISOString()
        });

        const fileId = await findFileInFolder(folderId, FILE_NAME);

        if (fileId) {
            // 파일 업데이트
            await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
                method: 'PATCH',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json' 
                },
                body: content
            });
        } else {
            // 파일 새로 생성 (기존 createFile 함수 호출)
            await createFile(folderId, FILE_NAME, content);
        }

        alert(`구글 드라이브에 안전하게 백업되었습니다! ✅`);
        closeBackupModal();
    } catch (error) {
        console.error("백업 실패:", error);
        alert("저장 중 오류가 발생했습니다.");
    } finally {
        syncBtn.innerText = "드라이브에 지금 저장하기";
        syncBtn.disabled = false;
    }
}

async function findFileInFolder(folderId, name) {
    const query = `'${folderId}' in parents and name = '${name}' and trashed = false`;
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    const result = await res.json();
    return (result.files && result.files.length > 0) ? result.files[0].id : null;
}
async function createFile(folderId, name, content) {
    const metadata = { name: name, parents: [folderId] };
    const formData = new FormData();
    formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    formData.append('file', new Blob([content], { type: 'application/json' }));

    await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${accessToken}` },
        body: formData
    });
}
async function updateFile(fileId, content) {
    await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: content
    });
}
// 3. 업로드 함수 내 토큰 참조 방식 수정

async function findOrCreateFolder(name) {

    if (!accessToken) {

        alert("인증 토큰이 만료되었습니다. 다시 로그인해주세요.");

        return;

    }



    const query = `name = '${name}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}`, {

        headers: { 'Authorization': `Bearer ${accessToken}` } // gapi.auth 대신 accessToken 직접 사용

    });

    const result = await response.json();



    if (result.files && result.files.length > 0) {

        return result.files[0].id;

    } else {

        const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {

            method: 'POST',

            headers: {

                'Authorization': `Bearer ${accessToken}`,

                'Content-Type': 'application/json'

            },

            body: JSON.stringify({

                name: name,

                mimeType: 'application/vnd.google-apps.folder'

            })

        });

        const folder = await createRes.json();

        return folder.id;

    }

}

// 설정 로드
async function getFolderId(folderName) {
    const response = await gapi.client.drive.files.list({
        q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id)',
    });
    const folders = response.result.files;
    return folders && folders.length > 0 ? folders[0].id : null;
}
async function loadYugaConfig() {
    try {
        // 1. '대시보드_설정' 폴더 ID 확인
        const folderId = await getFolderId('대시보드_설정');
        if (!folderId) {
            alert("'대시보드_설정' 폴더를 찾을 수 없습니다.");
            return;
        }

        // 2. 해당 폴더 내의 'yuga_config.json' 검색
        const fileResponse = await gapi.client.drive.files.list({
            q: `name = 'yuga_config.json' and '${folderId}' in parents and trashed = false`,
            fields: 'files(id, name)',
        });

        const files = fileResponse.result.files;
        if (!files || files.length === 0) {
            alert("설정 파일(yuga_config.json)이 폴더에 존재하지 않습니다.");
            return;
        }

        // 3. 파일 내용 다운로드
        const fileId = files[0].id;
        const contentResponse = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media',
        });

        // 4. 앱 설정에 적용
        const config = contentResponse.result;
        applySettings(config); // 이 함수에서 UI나 변수를 업데이트합니다.
        console.log("설정 로드 완료:", config);

    } catch (error) {
        console.error("파일을 불러오는 중 오류 발생:", error);
    }
}

async function downloadDataFromDrive() {
    if (!accessToken) return alert("먼저 구글 로그인을 해주세요.");
    if (!confirm("구글 드라이브의 설정을 불러올까요?\n현재 설정이 모두 덮어씌워집니다.")) return;

    const btn = document.querySelector('.btn-secondary-load'); // 불러오기 버튼 선택자 확인 필요
    if(btn) btn.innerText = "불러오는 중...";

    try {
        // 1. 폴더 찾기
        const folderId = await findOrCreateFolder(FOLDER_NAME);
        
        // 2. 파일 찾기
        const fileId = await findFileInFolder(folderId, FILE_NAME);
        if (!fileId) {
            alert("저장된 백업 파일이 없습니다. 먼저 저장하기를 눌러주세요.");
            return;
        }

        // 3. 파일 내용 다운로드 (fetch 사용)
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        
        const config = await res.json();
        console.log("백업 데이터 로드 성공:", config);

        // 4. 로컬 스토리지에 실제 적용 (핵심!)
        if (config.data) {
            localStorage.setItem('yuga_dashboard_v1', JSON.stringify(config.data));
        }
        if (config.theme) {
            localStorage.setItem('yuga_dashboard_theme', config.theme);
        }

        alert("모든 설정을 성공적으로 복원했습니다! 페이지를 새로고침합니다.");
        location.reload();

    } catch (error) {
        console.error("불러오기 실패:", error);
        alert("데이터를 불러오는 중 오류가 발생했습니다.");
    } finally {
        if(btn) btn.innerText = "설정 불러오기";
    }
}
// 초기화 함수 예시
function initClient() {
    gapi.client.init({
        apiKey: 'YOUR_API_KEY',
        clientId: 'YOUR_CLIENT_ID',
        // 이 부분이 반드시 포함되어야 합니다!
        discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"],
        scope: "https://www.googleapis.com/auth/drive.file"
    }).then(function () {
        console.log("GAPI 초기화 완료 및 Drive API 로드됨");
    }).catch(function(error) {
        console.error("초기화 실패:", error);
    });
}
/**

 * [8] 통합 초기화 실행

 */

window.addEventListener('DOMContentLoaded', () => {

    initTheme(); // 테마 초기화 추가

    // 1. 저장된 데이터(퀵런처, 디데이) 복원

    if (typeof loadAllFromLocal === 'function') loadAllFromLocal();

   

    // 2. 정보 그리드(시계) 즉시 시작

    updateInfoGrid();

    setInterval(updateInfoGrid, 1000); // 1초마다 시계 갱신



    // 3. 외부 데이터 호출 (날씨, 미세먼지, 급식)

    fetchRealTimeWeather();

    fetchAirQuality();      

    displayMeal();          



    // 4. 캘린더 즉시 렌더링

    renderCalendar();



    // 5. 시간표 하이라이트 체크

    if (typeof highlightCurrentPeriod === 'function') {

        highlightCurrentPeriod();

        setInterval(highlightCurrentPeriod, 60000);

    }

    // 구글 인증 초기화 추가

    if (typeof google !== 'undefined') {

        initGoogleAuth();

    }

    fetchNotices(); // 이 줄이 빠져있으면 불러오지 않습니다.

    setInterval(() => {

        fetchNotices();

    }, 5000);

});
