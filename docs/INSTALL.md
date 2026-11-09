# Установка SmartMeterMonitor

[← К проекту](../README.md)

## Требования

Проект проверен на OpenWrt 25.12.6 x86/64 с LuCI, rpcd и ucode-шаблонами. Нужны Python 3 с модулями SQLite и XML, `nmap` для ARP, `ping` для ICMP и `curl` для HTTP/HTTPS.

На проверенной системе используются `python3-light`, `python3-sqlite3`, `python3-xml`, `python3-urllib`, `curl`, `nmap`, `luci-base` и `rpcd-mod-file`. Имена доступных пакетов зависят от выпуска OpenWrt.

Проверьте модули Python перед запуском:

```sh
python3 -c 'import sqlite3, xml.etree.ElementTree, urllib.parse, fcntl'
```

Часовой пояс роутера определяет даты и время в истории; настройте его перед началом сбора данных.

## Получить исходники

На компьютере или роутере с установленным Git:

```sh
git clone https://github.com/garik816/SmartMeterMonitor.git
cd SmartMeterMonitor
```

Без Git на роутере можно скачать ZIP репозитория и перенести каталог `files/`.

## Скопировать файлы

Команды выполняются **на роутере** из корня скачанного проекта:

```sh
cp -a files/. /
chmod 755 /usr/bin/smartmeter-availability   /usr/libexec/smartmeter-availability-dashboard   /usr/libexec/smartmeter-availability-config   /etc/init.d/smartmeter-availability
```

Поставка содержит `/etc/config/smartmeter-availability.example`, а не рабочую конфигурацию. Уже существующие параметры не заменяются при копировании.

## Только для новой установки

Если `/etc/config/smartmeter-availability` отсутствует:

```sh
cp /etc/config/smartmeter-availability.example /etc/config/smartmeter-availability
chmod 600 /etc/config/smartmeter-availability
```

В секции `main` замените документальный адрес `192.0.2.10` реальным адресом устройства и проверьте сетевой интерфейс. Замените условный MAC либо очистите поле, если контроль MAC не нужен.

При обновлении существующей установки создание конфигурации пропускается.

## Запустить мониторинг

```sh
/etc/init.d/rpcd reload
/etc/init.d/smartmeter-availability enable
/etc/init.d/smartmeter-availability restart
```

Откройте **Services → Мониторинг доступности**. Если новый пункт не появился, очистите индекс LuCI и перезагрузите страницу:

```sh
rm -f /tmp/luci-indexcache.*.json
```

Адреса и дополнительные проверки удобно редактировать в интерфейсе. У каждой проверки свои тип, интервал, тайм-аут и срок хранения.

## Обновление

Сохраните собственную копию конфигурации и истории, затем скопируйте новые файлы и перезапустите службу. Для согласованной копии работающей базы используйте SQLite backup API: одного основного файла может быть недостаточно при активном WAL.

Не заменяйте рабочую конфигурацию примером. Идентификатор `main` продолжает использовать `/root/smartmeter-availability.sqlite3`; остальные проверки сохраняют собственные базы.

Удаление проверки из интерфейса удаляет её настройки, но оставляет файл истории на диске.

## Проверить состояние

```sh
/etc/init.d/smartmeter-availability status
/usr/libexec/smartmeter-availability-dashboard
```

Вторая команда возвращает JSON основной проверки. При включённой проверке интерфейс отображает результат последней пробы; отсутствие ответа устройства само по себе не означает ошибку страницы мониторинга.

Параметры службы и базы сохраняются при обычной перезагрузке роутера. Сохранение дополнительных файлов при **перепрошивке OpenWrt** настраивается отдельно в механизме резервирования конфигурации.

## Объединённая версия

Для графиков отключений, сравнения плана с фактом и определения очереди используйте [BlackoutMonitor](https://github.com/garik816/BlackoutMonitor). В нём уже включён этот монитор; его существующая конфигурация и история используются дальше.
