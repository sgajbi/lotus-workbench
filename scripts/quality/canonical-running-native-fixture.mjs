// Controlled native executable peer: verifies argv after PowerShell serialization.
// It never invokes Docker or accesses a runtime.
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
if (args[0] === "echo-format") {
  process.stdout.write(JSON.stringify(args.slice(1)));
} else {
  const { name, container, image } = JSON.parse(readFileSync(args.shift(), "utf8").replace(/^\uFEFF/, ""));
  const containerFormat = "{{json .Id}}{{println}}{{json .Image}}{{println}}{{json .State.Running}}{{println}}{{json (index .Config.Labels `com.docker.compose.project`)}}{{println}}{{json (index .Config.Labels `com.docker.compose.service`)}}{{println}}{{json (index .Config.Labels `com.docker.compose.project.working_dir`)}}{{println}}{{json .NetworkSettings.Ports}}";
  const imageFormat = "{{json .Id}}{{println}}{{json .Config.Labels}}";
  let records;
  let kind;
  if (args[0] === "ps") {
    process.stdout.write(container.id + "\n");
    process.exit(0);
  } else if (args[0] === "inspect" && args.length === 4 && args[1] === "--format" && args[2] === containerFormat && args[3] === container.id) {
    kind = "container";
    records = [container.id, container.image, container.running, container.project,
      container.service, container.checkout, container.ports];
  } else if (args[0] === "image" && args[1] === "inspect" && args.length === 5 && args[2] === "--format" && args[3] === imageFormat && args[4] === container.image) {
    kind = "image";
    records = [image.id, image.labels];
  } else {
    process.exit(31); // Unexpected or quote-corrupted native arguments.
  }
  if (name === "docker-native-failure" || name === `native-failure-${kind}`) process.exit(7);
  if (name === `malformed-${kind}`) {
    process.stdout.write("{\n");
    process.exit(0);
  }
  if (name === `truncated-${kind}`) records.pop();
  if (name === `extra-${kind}`) records.push("unexpected");
  if (name === `wrong-type-${kind}`) records[0] = [records[0]];
  if (name === `wrong-labels-${kind}`) records[kind === "container" ? 3 : 1] = [];
  const lines = records.map((record) => JSON.stringify(record));
  if (name === `invalid-json-${kind}`) lines[0] = "{broken";
  if (name === `blank-${kind}`) lines[0] = "";
  process.stdout.write(lines.join("\n") + "\n");
}
