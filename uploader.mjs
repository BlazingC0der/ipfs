import { Web3Storage, getFilesFromPath } from 'web3.storage'
import 'dotenv/config'
import DbGen from './pg.mjs'
import axios from 'axios';

const DbClient = DbGen()

DbClient.connect()
DbClient.on("connect", () => console.log("connection with DB established through port 5432"))

const update = (status, CbUrl, url, cid = null, err = null) => {
    console.log("updating...")
    if (err) {
        DbClient.query(`UPDATE jobs
                    SET status=$1, error=$2
                    WHERE file_url=$3 RETURNING*`, [status, err, url], (err, result) => {
            if (err) {
                console.log(err)
                return false
            } else {
                console.log(result.rows)
                return false
            }
        })
    } else {
        DbClient.query(`UPDATE jobs
                    SET status=$1
                    WHERE file_url=$2 RETURNING*`, [status, url], (err, result) => {
            if (err) {
                console.log(err)
                return false
            } else {
                console.log(result.rows)
                axios.post(CbUrl, { status, url: `https://dweb.link/ipfs/${cid}` })
                return true
            }
        })
    }
}

const uploader = async (guid, name, cb, link) => {
    const file = await getFilesFromPath(`./pdfs/${guid}.pdf`)
    const Web3Client = new Web3Storage({ token: process.env.Web3Token })
    const cid = await Web3Client.put(file, { name }).catch((err) => {
        return update("failed", cb, link, null, err)
    })
    return update("uploaded", cb, link, cid)
}

export default uploader

