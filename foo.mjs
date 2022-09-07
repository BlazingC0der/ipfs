import { createRequire } from "module"
const require = createRequire(import.meta.url)
import fs from "fs"
const { google } = require("googleapis")
import "dotenv/config"

const auth = await new google.auth.GoogleAuth({
    keyFile: "./keys/drive-key.json",
    scopes: ["https://www.googleapis.com/auth/drive"]
})

const drive = google.drive({
    version: "v3",
    auth: auth
})

const MetaData = {
    name: `${guid}.json`,
    parents: [process.env.DriveFolderId]
}

const media = {
    mimeType: "application/json",
    body: fs.createReadStream(`${process.env.MetaPath}${guid}.json`)
}