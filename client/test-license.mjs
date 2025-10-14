import { checkLicense } from "./license-client.js";

const r = await checkLicense();
console.log(JSON.stringify(r, null, 2));
