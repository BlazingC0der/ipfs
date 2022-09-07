import { getFilesFromPath } from "web3.storage"

const GetFile = async (path) => {
    return getFilesFromPath(path)
}

export default GetFile
