import { Web3Storage } from "web3.storage"
import "dotenv/config"
import DbGen from "./pg.mjs"
import axios from "axios"
import GetFile from "./FileGetter.mjs"
import logger from "./logger.mjs"

const DbClient = DbGen()
// connecting to pg sever
DbClient.connect()
DbClient.on("connect", () =>
    console.log("connection with DB established through port 5432")
)
// @param params error msg and updated no. of retries in case upload fails otherwise id,status, callback url and cid for uploaded fiel is passed
const update = (id, ...params) => {
    if (params.length === 2) {
        let err = params[0]
        let retries = params[1]
        let status = retries === 0 ? "failed" : "pending upload"
        //* updating error msg and decremnting no. of retries in the DB
        DbClient.query(
            `UPDATE jobs
                    SET retries=$1, error=$2, status=$3
                    WHERE id=$4 RETURNING*`,
            [retries, err, status, id],
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
        let status = params[0]
        let cb = params[1]
        let cid = params[2]
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
    console.log("uploading....")
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
