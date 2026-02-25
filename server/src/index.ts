import { createApp } from "./app";
import { verifyCoreRuntime } from "./coreRuntime";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

verifyCoreRuntime();

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on ${port}`);
});
