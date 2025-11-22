import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import dayjs from "dayjs";

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(localizedFormat)

export default dayjs;