import { applicationValue } from "../application/public.js";
import { sessionValue } from "../modules/session/public.js";

export const runtimeValue = `${applicationValue}:${sessionValue}`;
