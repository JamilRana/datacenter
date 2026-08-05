import fs from "fs";
const file = fs.readFileSync("src/app/requests/components/RequestForm.tsx", "utf-8");
const lines = file.split("\n");
for (let i = 1450; i < 1650; i++) {
  if (lines[i]) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}
