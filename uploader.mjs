import { Web3Storage } from "web3.storage"
import "dotenv/config"
import DbGen from "./pg.mjs"
import axios from "axios"
import GetFile from "./FileGetter.mjs"
import winston from "winston"

const logger = winston.createLogger({
    level: "error",
    format: winston.format.json(),
    defaultMeta: { service: "user-service" },
    transports: [
        // - Write all logs with importance level of `error` or less to `error.log`
        new winston.transports.File({ filename: "error.log", level: "error" }),
    ],
})

const DbClient = DbGen()
// connecting to pg sever
DbClient.connect()
DbClient.on("connect", () =>
    console.log("connection with DB established through port 5432")
)
// @param params:job id, error msg and updated no. of retries in case upload fails otherwise id,status, callback url and cid for uploaded fiel is passed
const update = (...params) => {
    console.log("updating...")
    if (params.length === 3) {
        let id = params[0]
        let err = params[1]
        let retries = params[2]
        //* updating error msg and decremnting no. of retries in the DB
        DbClient.query(
            `UPDATE jobs
                    SET retries=$1, error=$2
                    WHERE id=$3 RETURNING*`,
            [retries, err, id],
            (err, result) => {
                if (err) {
                    logger.error(err)
                    console.log(err)
                } else {
                    console.log(result.rows)
                }
            }
        )
        return false
    } else {
        let flag = true
        let id = params[0]
        let status = params[1]
        let cb = params[2]
        let cid = params[3]
        const IpfsLink = `https://dweb.link/ipfs/${cid}` // url to access file uploaded to ipfs
        //* updating status to uploaded and enetring ipfs url into DB
        DbClient.query(
            `UPDATE jobs
                    SET status=$1, ipfs_url=$2
                    WHERE id=$3 RETURNING*`,
            [status, IpfsLink, id],
            (err, result) => {
                if (err) {
                    logger.error(err)
                    console.log(err)
                    flag = false
                } else {
                    console.log(result.rows)
                    try {
                        //* posting feedback to callback api to inform about successful upload to ipfs
                        axios.post(cb, { status, url: IpfsLink, error: null })
                    } catch (err) {
                        logger.error(err)
                        throw err
                    }
                }
            }
        )
        return flag
    }
}

const uploader = async (guid, name, cb, id, retries) => {
    const file = await GetFile(`./pdfs/${guid}.pdf`) // getting file from  locla storage
    const Web3Client = new Web3Storage({ token: process.env.Web3Token }) // creating a web.storage client instance
    try {
        //* uploading to ipfs using web3.storage pinnning service
        const cid = await Web3Client.put(file, { name: name })
        //* updating status upon succesful upload to ipfs
        return update(id, "uploaded", cb, cid) // returns true
    } catch (err) {
        logger.error(err)
        //* deceremnting retries upon failed attempt to upload file to ipfs
        return update(id, err, retries - 1) // returns false
    }
}

export default uploader