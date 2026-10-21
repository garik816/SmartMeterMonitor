'use strict';
'require view';
'require fs';
'require poll';
'require ui';

const PROGRAM = '/usr/libexec/smartmeter-availability-dashboard';
const CONFIG_PROGRAM = '/usr/libexec/smartmeter-availability-config';
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
.sm-targets { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0; }
.sm-targets button { border:1px solid rgba(127,127,127,.35); border-radius:7px; padding:8px 11px; background:transparent; cursor:pointer; }
.sm-targets button.sm-selected { border-color:#2563eb; background:rgba(37,99,235,.12); }
.sm-targets small { display:block; color:#727a82; }
.sm-settings-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(205px,1fr)); gap:10px 14px; }
.sm-settings-grid label { display:block; font-size:.9rem; }
.sm-settings-grid input, .sm-settings-grid select { display:block; box-sizing:border-box; width:100%; margin-top:4px; }
.sm-settings-grid label.sm-check { display:flex; align-items:center; gap:7px; }
.sm-settings-grid label.sm-check input { width:auto; margin:0; }
.sm-target-settings { border-top:1px solid rgba(127,127,127,.25); padding:12px 0; }
.sm-target-settings:first-child { border-top:0; }
.sm-settings-actions { display:flex; flex-wrap:wrap; gap:8px; margin-top:12px; }
`;

function getData(target, day) {
	const args = [];
	if (target)
		args.push(target);
	if (target && day)
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
		this.selectedTarget = data.selected_target;
		this.targets = data.targets.map(item => Object.assign({}, item));
		this.targetsNode = E('div', { 'class': 'sm-targets' });
		this.descriptionNode = E('p', { 'class': 'cbi-section-descr' });
		this.settingsNode = E('div');
		this.statusNode = E('div');
		this.cardsNode = E('div', { 'class': 'sm-cards' });
		this.calendarNode = E('div');
		this.dayNode = E('div');
		this.dateInput = E('input', {
			'type': 'date',
			'class': 'cbi-input-text',
			'change': ev => this.selectDay(ev.target.value)
		});
		this.renderSettings();
		this.draw(data);
		poll.add(() => this.refresh(), 30);
		return E('div', [
			E('style', { 'type': 'text/css' }, STYLES),
			E('h2', 'Мониторинг доступности'),
			this.targetsNode,
			this.descriptionNode,
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
			]),
			E('div', { 'class': 'sm-panel' }, [
				E('h3', 'Настройки проверок'),
				E('p', { 'class': 'sm-muted' }, 'Интервал и тайм-аут задаются отдельно для каждого адреса. HTTP-проверка выполняет GET и сверяет итоговый код ответа.'),
				this.settingsNode,
				E('div', { 'class': 'sm-settings-actions' }, [
					E('button', { 'type': 'button', 'class': 'btn', 'click': () => this.addTarget() }, 'Добавить адрес'),
					E('button', { 'type': 'button', 'class': 'btn cbi-button-positive', 'click': () => this.saveSettings() }, 'Сохранить и применить')
				])
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
		return getData(this.selectedTarget, this.selectedDay).then(data => this.draw(data)).catch(error => {
			ui.addNotification(null, E('p', 'Не удалось загрузить статистику: ' + error.message), 'error');
		});
	},

	selectTarget: function(ident) {
		this.selectedTarget = ident;
		return this.refresh();
	},

	settingField: function(target, key, label, kind, extra) {
		const attrs = Object.assign({ 'data-field': key, 'class': 'cbi-input-text' }, extra || {});
		let control;
		if (kind == 'type') {
			control = E('select', Object.assign(attrs, {
				'change': ev => this.updateTypeFields(ev.target.closest('.sm-target-settings'))
			}), [
				E('option', target.type == 'arp' ? { 'value': 'arp', 'selected': '' } : { 'value': 'arp' }, 'ARP · локальное устройство'),
				E('option', target.type == 'icmp' ? { 'value': 'icmp', 'selected': '' } : { 'value': 'icmp' }, 'ICMP · ping'),
				E('option', target.type == 'http' ? { 'value': 'http', 'selected': '' } : { 'value': 'http' }, 'HTTP/HTTPS · веб-ресурс')
			]);
		}
		else {
			attrs.type = kind;
			attrs.value = target[key] || '';
			control = E('input', attrs);
		}
		return E('label', [label, control]);
	},

	updateTypeFields: function(panel) {
		const kind = panel.querySelector('[data-field="type"]').value;
		panel.querySelectorAll('[data-for]').forEach(node => {
			node.hidden = node.getAttribute('data-for').split(' ').indexOf(kind) < 0;
		});
	},

	renderSettings: function() {
		this.settingsNode.replaceChildren(...this.targets.map(target => {
			const panel = E('div', { 'class': 'sm-target-settings', 'data-id': target.id }, [
				E('div', { 'class': 'sm-settings-actions' }, [
					E('h4', target.name || 'Новая проверка'),
					E('button', { 'type': 'button', 'class': 'btn cbi-button-negative',
						'click': () => this.removeTarget(target.id) }, 'Удалить')
				]),
				E('div', { 'class': 'sm-settings-grid' }, [
					this.settingField(target, 'name', 'Название', 'text', { 'maxlength': 80 }),
					this.settingField(target, 'type', 'Тип проверки', 'type'),
					E('label', { 'class': 'sm-check' }, [
						E('input', target.enabled != '0' ?
							{ 'type': 'checkbox', 'data-field': 'enabled', 'checked': '' } :
							{ 'type': 'checkbox', 'data-field': 'enabled' }),
						'Включена'
					]),
					E('div', { 'data-for': 'arp icmp' }, this.settingField(target, 'host', 'IP-адрес или имя хоста', 'text')),
					E('div', { 'data-for': 'http' }, this.settingField(target, 'url', 'URL с http:// или https://', 'url')),
					E('div', { 'data-for': 'arp' }, this.settingField(target, 'interface', 'Интерфейс для ARP', 'text')),
					E('div', { 'data-for': 'arp' }, this.settingField(target, 'mac', 'Ожидаемый MAC (необязательно)', 'text')),
					this.settingField(target, 'interval', 'Интервал, сек', 'number', { 'min': 5, 'max': 3600 }),
					this.settingField(target, 'timeout', 'Тайм-аут, сек', 'number', { 'min': 1, 'max': 60 }),
					E('div', { 'data-for': 'http' }, this.settingField(target, 'expected_status', 'Ожидаемый HTTP-код', 'number', { 'min': 100, 'max': 599 })),
					this.settingField(target, 'retention_days', 'Хранить пробы, дней', 'number', { 'min': 1, 'max': 3650 })
				])
			]);
			return panel;
		}));
		this.settingsNode.querySelectorAll('.sm-target-settings').forEach(panel => this.updateTypeFields(panel));
	},

	collectSettings: function() {
		return Array.from(this.settingsNode.querySelectorAll('.sm-target-settings')).map(panel => {
			const item = { id: panel.getAttribute('data-id') };
			['name', 'type', 'host', 'url', 'interface', 'mac', 'interval', 'timeout',
				'expected_status', 'retention_days'].forEach(key => {
				item[key] = panel.querySelector('[data-field="' + key + '"]').value;
			});
			item.enabled = panel.querySelector('[data-field="enabled"]').checked ? '1' : '0';
			return item;
		});
	},

	addTarget: function() {
		this.targets = this.collectSettings();
		const ident = 'mon_' + Date.now().toString(36);
		this.targets.push({ id: ident, name: '', type: 'icmp', host: '', url: '',
			interface: 'br-lan', mac: '', interval: '30', timeout: '5',
			expected_status: '200', retention_days: '30', enabled: '1' });
		this.renderSettings();
	},

	removeTarget: function(ident) {
		const targets = this.collectSettings();
		if (targets.length <= 1) {
			ui.addNotification(null, E('p', 'Нужна хотя бы одна проверка.'), 'warning');
			return;
		}
		this.targets = targets.filter(item => item.id != ident);
		this.renderSettings();
	},

	saveSettings: function() {
		const targets = this.collectSettings();
		return fs.exec_direct(CONFIG_PROGRAM, [JSON.stringify(targets)], 'json').then(result => {
			if (!result || result.error)
				throw new Error(result && result.error || 'Не удалось сохранить настройки');
			this.targets = result.targets;
			this.renderSettings();
			if (!targets.some(item => item.id == this.selectedTarget))
				this.selectedTarget = targets[0].id;
			ui.addNotification(null, E('p', 'Проверки сохранены и перезапущены.'), 'info');
			return this.refresh();
		}).catch(error => {
			ui.addNotification(null, E('p', 'Ошибка сохранения: ' + error.message), 'error');
		});
	},

	renderTargets: function(data) {
		this.targetsNode.replaceChildren(...data.targets.map(target => {
			const current = target.current;
			const state = target.enabled == '0' ? 'выключено' : !current ? 'нет данных' :
				!current.monitor_running ? 'остановлено' : current.status == 'up' ? 'доступно' :
				current.status == 'down' ? 'недоступно' : 'ошибка';
			return E('button', { 'type': 'button',
				'class': target.id == data.selected_target ? 'sm-selected' : '',
				'click': () => this.selectTarget(target.id) }, [target.name, E('small', state)]);
		}));
	},

	draw: function(data) {
		this.data = data;
		this.selectedDay = data.selected_day;
		this.selectedTarget = data.selected_target;
		this.renderTargets(data);
		const target = data.target;
		const endpoint = target.type == 'http' ? target.url : target.host;
		const method = target.type == 'arp' ? 'ARP' : target.type == 'icmp' ? 'ICMP' : 'HTTP/HTTPS';
		this.descriptionNode.textContent = target.name + ' · ' + endpoint + ' · ' + method +
			' · интервал ' + target.interval + ' сек · тайм-аут ' + target.timeout +
			' сек. Пустые периоды на графике означают отсутствие данных.';
		const current = data.current;
		let badgeClass = 'sm-badge-idle';
		let label = 'Нет данных';
		if (target.enabled == '0')
			label = 'Проверка выключена';
		else if (current && !current.monitor_running)
			label = 'Монитор остановлен';
		else if (current && current.status == 'up') {
			badgeClass = 'sm-badge-up';
			label = 'Ресурс доступен';
		}
		else if (current && current.status == 'down') {
			badgeClass = 'sm-badge-down';
			label = 'Ресурс недоступен';
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
