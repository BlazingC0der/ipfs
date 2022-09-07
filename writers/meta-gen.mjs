import axios from "axios"
import "dotenv/config"
import fs from "fs"
import DbGen from "../utils/pg.mjs"

const DbClient = DbGen()
// connecting to pg sever
DbClient.connect()

const update = (id, err) => {
    DbClient.query(
        `UPDATE jobs
  SET err=$1, status=$2
  WHERE id=$3`,
        [err, "pending meta download", id],
        (err, res) => {
            err ? console.log(err) : console.log(res)
        }
    )
}

const MetaDataWriter = async (
    existing,
    filename,
    id,
    ResumeLink,
    MetaLink = ""
) => {
    console.log("generating metadata...")
    let flag = true
    if (!existing) {
        const metadata = {
            UserId: id,
            image: process.env.ImgUrl,
            LatestVersion: 1,
            v1: ResumeLink
        }
        fs.writeFile(
            `${process.env.MetaPath}${filename}.json`,
            JSON.stringify(metadata),
            (err) => {
                // TODO decremnt retries
                flag = false
                console.log(err)
            }
        )
    } else {
        try {
            const res = await axios.get(MetaLink)
            console.log(res.data)
            const metadata = {
                ...res.data
            }
            metadata.LatestVersion++
            metadata[`v${metadata.LatestVersion}`] = ResumeLink
            fs.writeFile(
                `${process.env.MetaPath}${filename}.json`,
                JSON.stringify(metadata),
                (err) => {
                    // TODO decremnt retries
                    console.log(err)
                }
            )
        } catch (error) {
            // TODO decremnt retries
            flag = false
            update(id, error)
            throw error
        }
    }
    return flag
}

export default MetaDataWriter
