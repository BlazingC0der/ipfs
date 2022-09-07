import { createRequire } from "module"
const require = createRequire(import.meta.url)
import fs from "fs"
const { google } = require("googleapis")
import "dotenv/config"
import DbGen from "../utils/pg.mjs"

const DbClient = DbGen()
// connecting to pg sever
DbClient.connect()

const update = (id, url, err = null, existing = false) => {
    if (err) {
        let status = existing
            ? "pending meta upload"
            : "pending meta upload and mint"
        DbClient.query(
            `UPDATE jobs
    SET err=$1, status=$2
    WHERE id=$3`,
            [err, status, id],
            (err, res) => {
                if (err) {
                    console.log(err)
                } else {
                    console.log(res)
                }
            }
        )
    } else {
        DbClient.query(
            `UPDATE jobs
    SET meta_url=$1
    WHERE id=$2`,
            [url, id],
            (err, res) => {
                if (err) {
                    console.log(err)
                } else {
                    console.log(res)
                }
            }
        )
    }
}

const UploadJson = async (guid, id, FileId = null) => {
    console.log("uploading metadata...")
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
    try {
        if (FileId) {
            const res = await drive.files.update({
                fileId: FileId,
                addParents: process.env.DriveFolderId,
                media: media,
                field: "id"
            })
            const link = `https://drive.google.com/uc?export=view&id=${res.data.id}`
            return link
        } else {
            const res = await drive.files.create({
                resource: MetaData,
                media: media,
                field: "id"
            })
            const link = `https://drive.google.com/uc?export=view&id=${res.data.id}`
            update(id, link)
            return link
        }
    } catch (err) {
        FileId ? update(id, null, err, true) : update(id, null, err)
        throw err
    }
}

export default UploadJson
