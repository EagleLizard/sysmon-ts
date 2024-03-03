
import { format } from 'date-fns';

export function getDateStr(date: Date) {
  /*
    [02-27-2024] 09:45 PM
    [02-27-2024] 09:49 PM
  */
  return format(date, '[MM-dd-y] hh:mm aa');
}
