'use strict';
'require view';
'require fs';
'require poll';
'require ui';

const PROGRAM = '/usr/libexec/smartmeter-availability-dashboard';
const MONTHS = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const STYLES = `
.sm-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin:16px 0; }
.sm-card { border:1px solid rgba(127,127,127,.28); border-radius:10px; padding:13px 15px; }
.sm-card strong { display:block; font-size:1.45rem; line-height:1.3; margin:4px 0; }
.sm-muted { color:#727a82; font-size:.9rem; }
.sm-badge { display:inline-block; border-radius:99px; padding:5px 10px; font-weight:600; }
.sm-badge-up { background:#d8f3df; color:#145b2b; }
.sm-badge-down { background:#ffe1df; color:#a01e1e; }
.sm-badge-idle { background:#e9ecef; color:#535d66; }
.sm-panel { margin:18px 0; padding:16px; border:1px solid rgba(127,127,127,.25); border-radius:10px; }
.sm-panel h3 { margin-top:0; }
.sm-year-scroll, .sm-minute-scroll { overflow-x:auto; padding-bottom:8px; }
.sm-year-layout { display:flex; align-items:flex-start; gap:8px; }
.sm-weekdays { display:grid; grid-template-rows:repeat(7,12px); gap:4px; padding-top:22px; font-size:10px; line-height:12px; color:#6b7280; }
.sm-months { height:20px; position:relative; font-size:11px; color:#6b7280; white-space:nowrap; }
.sm-months span { position:absolute; top:0; }
.sm-year-grid { display:grid; grid-auto-flow:column; grid-template-rows:repeat(7,12px); grid-auto-columns:12px; gap:4px; width:max-content; }
.sm-day, .sm-minute { display:block; padding:0; border:0; border-radius:2px; box-sizing:border-box; }
.sm-day { width:12px; height:12px; cursor:pointer; }
.sm-day:hover, .sm-day-selected { outline:2px solid #2f3d4a; outline-offset:1px; }
.sm-day-empty { width:12px; height:12px; }
.sm-level-none { background:#e5e9ec; }
.sm-level-up { background:#1e7d3d; }
.sm-level-good { background:#58b96a; }
.sm-level-partial { background:#a8d879; }
.sm-level-mixed { background:#e4b84f; }
.sm-level-down { background:#d94e4e; }
.sm-level-error { background:#987ac2; }
.sm-legend { display:flex; flex-wrap:wrap; gap:12px; align-items:center; margin-top:12px; font-size:.85rem; }
.sm-swatch { display:inline-block; width:11px; height:11px; border-radius:2px; margin-right:4px; vertical-align:middle; }
.sm-day-controls { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin:0 0 12px; }
.sm-day-controls input { max-width:170px; }
.sm-minute-header, .sm-minute-row { display:grid; grid-template-columns:48px repeat(60,10px); gap:2px; width:max-content; }
.sm-minute-header { color:#7b838a; font-size:10px; margin-bottom:5px; }
.sm-minute-header span:first-child { grid-column:1; }
.sm-minute-header span { grid-column:span 10; }
.sm-minute-row { align-items:center; margin:2px 0; }
.sm-hour-label { color:#67727c; font-size:11px; }
.sm-minute { width:10px; height:14px; }
.sm-outages { margin:12px 0 0; padding-left:18px; }
.sm-outages li { margin:5px 0; }
`;

function getData(day) {
	const args = [];
	if (day)
		args.push(day);
	return fs.exec_direct(PROGRAM, args, 'json').then(data => {
		if (data && data.error)
			throw new Error(data.error);
		return data;
	});
}

function dateFromKey(key) {
	return new Date(key + 'T12:00:00');
}

function dateKey(date) {
	return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
		String(date.getDate()).padStart(2, '0');
}

function addDays(date, count) {
	const copy = new Date(date);
	copy.setDate(copy.getDate() + count);
	return copy;
}

function percent(item) {
	return item && item.availability != null ? item.availability.toFixed(2) + '%' : '—';
}

function level(item) {
	if (!item || !item.up && !item.down)
		return item && item.error ? 'error' : 'none';
	if (!item.up)
		return 'down';
	if (!item.down)
		return 'up';
	const ratio = item.up / (item.up + item.down);
	return ratio >= .95 ? 'good' : ratio >= .8 ? 'partial' : 'mixed';
}

function duration(seconds) {
	seconds = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor(seconds % 3600 / 60);
	const remainder = seconds % 60;
	return (hours ? hours + ' ч ' : '') + (minutes || hours ? minutes + ' мин ' : '') + remainder + ' сек';
}

return view.extend({
	load: function() {
		return getData();
	},

	render: function(data) {
		this.selectedDay = data.selected_day;
		this.statusNode = E('div');
		this.cardsNode = E('div', { 'class': 'sm-cards' });
		this.calendarNode = E('div');
		this.dayNode = E('div');
		this.dateInput = E('input', {
			'type': 'date',
			'class': 'cbi-input-text',
			'change': ev => this.selectDay(ev.target.value)
		});
		this.draw(data);
		poll.add(() => this.refresh(), 30);
		return E('div', [
			E('style', { 'type': 'text/css' }, STYLES),
			E('h2', 'SmartMeter'),
			E('p', { 'class': 'cbi-section-descr' },
				'Монитор проверяет 192.168.1.113 каждые 15 секунд по ARP. Цветные клетки показывают результаты проверок, а пустые периоды означают отсутствие данных.'),
			this.statusNode,
			this.cardsNode,
			E('div', { 'class': 'sm-panel' }, [
				E('h3', 'Активность по дням'),
				this.calendarNode,
				E('div', { 'class': 'sm-legend' }, [
					this.legend('none', 'нет данных'),
					this.legend('up', 'доступно'),
					this.legend('good', 'почти всегда доступно'),
					this.legend('partial', 'частичные сбои'),
					this.legend('mixed', 'частые сбои'),
					this.legend('down', 'недоступно'),
					this.legend('error', 'ошибка проверки')
				])
			]),
			E('div', { 'class': 'sm-panel' }, [
				E('h3', 'По часам и минутам'),
				E('div', { 'class': 'sm-day-controls' }, [
					E('button', { 'type': 'button', 'class': 'btn', 'click': () => this.shiftDay(-1) }, '← День'),
					this.dateInput,
					E('button', { 'type': 'button', 'class': 'btn', 'click': () => this.shiftDay(1) }, 'День →'),
					E('button', { 'type': 'button', 'class': 'btn', 'click': () => this.refresh() }, 'Обновить')
				]),
				this.dayNode
			])
		]);
	},

	legend: function(levelName, label) {
		return E('span', [E('i', { 'class': 'sm-swatch sm-level-' + levelName }), label]);
	},

	selectDay: function(day) {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
			return;
		this.selectedDay = day;
		return this.refresh();
	},

	shiftDay: function(amount) {
		const day = dateKey(addDays(dateFromKey(this.selectedDay), amount));
		if (day >= this.dateInput.min && day <= this.dateInput.max)
			return this.selectDay(day);
	},

	refresh: function() {
		return getData(this.selectedDay).then(data => this.draw(data)).catch(error => {
			ui.addNotification(null, E('p', 'Не удалось загрузить статистику: ' + error.message), 'error');
		});
	},

	draw: function(data) {
		this.data = data;
		this.selectedDay = data.selected_day;
		const current = data.current;
		let badgeClass = 'sm-badge-idle';
		let label = 'Нет данных';
		if (current && !current.monitor_running)
			label = 'Монитор остановлен';
		else if (current && current.status == 'up') {
			badgeClass = 'sm-badge-up';
			label = 'Устройство доступно';
		}
		else if (current && current.status == 'down') {
			badgeClass = 'sm-badge-down';
			label = 'Устройство недоступно';
		}
		else if (current)
			label = 'Ошибка проверки';
		this.statusNode.replaceChildren(E('p', [
			E('span', { 'class': 'sm-badge ' + badgeClass }, label), ' ',
			E('span', { 'class': 'sm-muted' }, current ?
				'Последняя проверка: ' + current.time + ' · ' + current.reason : 'Проверок пока нет')
		]));
		const cards = [
			['Сегодня', data.summary.today],
			['7 дней', data.summary.week],
			['30 дней', data.summary.month],
			['За всё время', data.summary.all]
		];
		this.cardsNode.replaceChildren(...cards.map(pair => E('div', { 'class': 'sm-card' }, [
			E('span', pair[0]),
			E('strong', percent(pair[1])),
			E('span', { 'class': 'sm-muted' },
				'Доступно: ' + pair[1].up + ' · Недоступно: ' + pair[1].down +
				' · Ошибки: ' + pair[1].error)
		])));
		this.drawCalendar(data);
		this.drawDay(data);
	},

	drawCalendar: function(data) {
		const dayMap = {};
		data.days.forEach(item => dayMap[item.day] = item);
		const today = dateFromKey(data.today);
		const firstDay = addDays(today, -364);
		const firstMonday = addDays(firstDay, -((firstDay.getDay() + 6) % 7));
		const cells = [];
		const months = [];
		for (let day = new Date(firstMonday); day <= today; day = addDays(day, 1)) {
			const key = dateKey(day);
			const week = Math.floor(cells.length / 7);
			if (day.getDate() == 1 || cells.length == 0)
				months.push(E('span', { 'style': 'left:' + (week * 16) + 'px' }, MONTHS[day.getMonth()]));
			if (day < firstDay) {
				cells.push(E('span', { 'class': 'sm-day-empty' }));
				continue;
			}
			const item = dayMap[key];
			const detail = item ?
				key + ': ' + percent(item) + ' · доступно ' + item.up +
				', недоступно ' + item.down + ', ошибок ' + item.error :
				key + ': нет данных';
			cells.push(E('button', {
				'type': 'button',
				'class': 'sm-day sm-level-' + level(item) + (key == this.selectedDay ? ' sm-day-selected' : ''),
				'title': detail,
				'aria-label': detail,
				'click': () => this.selectDay(key)
			}));
		}
		const width = Math.ceil(cells.length / 7) * 16;
		this.calendarNode.replaceChildren(E('div', { 'class': 'sm-year-scroll' }, [
			E('div', { 'class': 'sm-year-layout' }, [
				E('div', { 'class': 'sm-weekdays' }, WEEKDAYS.map(day => E('span', day))),
				E('div', [
					E('div', { 'class': 'sm-months', 'style': 'width:' + width + 'px' }, months),
					E('div', { 'class': 'sm-year-grid' }, cells)
				])
			])
		]));
	},

	drawDay: function(data) {
		this.dateInput.value = data.selected_day;
		this.dateInput.max = data.today;
		this.dateInput.min = dateKey(addDays(dateFromKey(data.today), -364));
		const minutes = {};
		data.minutes.forEach(item => minutes[item.minute] = item);
		const summary = data.days.find(item => item.day == data.selected_day);
		const rows = [];
		for (let hour = 0; hour < 24; hour++) {
			const children = [E('span', { 'class': 'sm-hour-label' }, String(hour).padStart(2, '0') + ':00')];
			for (let minute = 0; minute < 60; minute++) {
				const item = minutes[hour * 60 + minute];
				const label = String(hour).padStart(2, '0') + ':' + String(minute).padStart(2, '0');
				const description = item ? label + ' · доступно ' + item.up +
					', недоступно ' + item.down + ', ошибок ' + item.error : label + ' · нет данных';
				children.push(E('span', {
					'class': 'sm-minute sm-level-' + level(item),
					'title': description,
					'aria-label': description
				}));
			}
			rows.push(E('div', { 'class': 'sm-minute-row' }, children));
		}
		const heading = E('p', [
			E('strong', data.selected_day + ' · ' + percent(summary)),
			' · зелёный — доступно, красный — недоступно, серый — нет данных. Наведите на минуту для числа проверок.'
		]);
		const header = E('div', { 'class': 'sm-minute-header' }, [
			E('span', ''),
			...['00', '10', '20', '30', '40', '50'].map(label => E('span', label))
		]);
		const outages = data.outages.length ? E('ul', { 'class': 'sm-outages' },
			data.outages.map(item => E('li',
				item.started + ' → ' + (item.ended || 'продолжается') +
				' · ' + duration(item.duration_seconds) +
				(item.interrupted ? ' · наблюдение прервалось' : '')))) :
			E('p', { 'class': 'sm-muted' }, 'Зарегистрированных сбоев за этот день нет.');
		this.dayNode.replaceChildren(
			heading,
			E('div', { 'class': 'sm-minute-scroll' }, [header, ...rows]),
			E('h4', 'Периоды недоступности'),
			outages
		);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
