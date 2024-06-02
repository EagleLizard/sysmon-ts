
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

export function getDateStr(date: Date) {
  /*
    [02-27-2024] 09:45 PM
    [02-27-2024] 09:49 PM
  */
  return format(date, '[MM-dd-y] hh:mm aa');
}

export function getDateFileStr(date: Date) {
  /*
    02272024_0945
    02272024_1304
  */
  return format(date, 'MMddy_kkmm');
}

/*
  alphabetically sortable datetime string
*/
export function getLexicalDateTimeStr(date: Date) {
  return format(date, 'y-MM-dd_HH-mm-ss');
}
export function getDebugDateTimeStr(date: Date) {
  return format(date, '[MM-dd-y] HH:mm:ss.SSS');
}

export function getDayStr(date: Date) {
  return format(date, 'E');
}

export function get24HourTimeStr(date: Date) {
  let tz: string;
  tz = new Intl.DateTimeFormat().resolvedOptions().timeZone;
  return formatInTimeZone(date, tz, 'HH:mm:ss');
}
