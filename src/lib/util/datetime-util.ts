
import { format } from 'date-fns';

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

export function getDayStr(date: Date) {
  return format(date, 'E');
}
