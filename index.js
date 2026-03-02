import { access, readFile, writeFile, mkdir, readdir, cp, rename, stat, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';

/**
 * @summary Writes content to a file safely
 * @description Writes content to a file at the specified path, then verifies the file is readable and its content matches exactly what was written.
 * @param {String} path Absolute or relative path of the file to write
 * @param {String} content UTF-8 string content to write into the file
 * @returns {Promise<void>} Resolves when the file has been written and verified successfully
 * @throws {Error} If the file could not be written, is not readable after writing, or its content does not match the expected value
 */
export async function writeFileSafe(path, content) {

    try {

        await writeFile(path, content, 'utf8');

        try {

            // Check that the file was created and is readable
            try {
                await access(path, constants.R_OK);
            } catch (error) {
                const customError = new Error("File was not created or is not readable", { cause: error });
                customError.data = {
                    path
                };
                throw customError;
            }

            // Check that the file content matches the expected content
            try {
                const fileContent = await readFile(path, 'utf8');
                if (fileContent !== content) {
                    const customError = new Error("File content does not match expected content");
                    customError.data = {
                        path,
                        expectedContent: content,
                        actualContent: fileContent
                    };
                    throw customError;
                }
            } catch (error) {
                const customError = new Error("Unable to verify file content", { cause: error });
                customError.data = {
                    path
                };
                throw customError;
            }

        } catch (error) {

            const customError = new Error("File verification", { cause: error });
            customError.data = {
                path
            };
            throw customError;

        }

    } catch (error) {

        const customError = new Error("Unable to write file", { cause: error });
        customError.data = {
            path
        };
        throw customError;

    }

}

/**
 * @summary Checks if a path exists and is readable
 * @description Attempts to access the given path with read permission. Returns false for any access error without throwing.
 * @param {String} path Absolute or relative path to check
 * @returns {Promise<Boolean>} Resolves to true if the path exists and is readable, false otherwise
 */
export async function fileExists(path) {

    try {
        await access(path, constants.R_OK);
        return true;
    } catch {
        return false;
    }

}


/**
 * @summary Creates a directory safely
 * @description Creates a directory at the specified path, including any missing parent directories. If the directory already exists and deleteIfExists is true, it is deleted before recreation.
 * @param {String} path Absolute or relative path of the directory to create
 * @param {Boolean} [deleteIfExists=false] When true, deletes the existing directory and its contents before creating a fresh one
 * @returns {Promise<void>} Resolves when the directory has been created and verified as accessible
 * @throws {Error} If the directory could not be created or is not accessible after creation
 */
export async function mkdirSafe(path, deleteIfExists = false) {

    try {

        if (await fileExists(path)) {

            if (deleteIfExists) {
                await deleteFileSafe(path);
            }

        }

        await mkdir(path, { recursive: true });

        // Check that the directory was created and is accessible
        await fileExistsAndAccessible_errorOnFail(path);

    } catch (error) {
        const customError = new Error("Unable to create directory", { cause: error });
        customError.data = {
            path
        };
        throw customError;
    }

}

/**
 * @summary Deletes a file safely
 * @description Deletes a file at the specified path, ensuring it is deleted successfully.
 * @param {String} path Path of the file to be deleted
 * @returns {Promise<void>} Resolves if the file was deleted successfully, otherwise throws an error
 * @throws {Error} If the file could not be deleted or still exists after deletion
 */
export async function deleteFileSafe(path) {

    try {

        await fileExistsAndAccessible_errorOnFail(path);

        await rm(path, { recursive: true });

        await fileDoesNotExist_errorOnFail(path);

    } catch (error) {
        const customError = new Error("Unable to delete file", { cause: error });
        customError.data = {
            path
        };
        throw customError;
    }

}

/**
 * @summary Empties a directory safely
 * @description Deletes all direct children (files and subdirectories) inside the given directory, then verifies it is empty. The directory itself is preserved.
 * @param {String} path Absolute or relative path of the directory to empty
 * @returns {Promise<void>} Resolves when the directory has been emptied and verified
 * @throws {Error} If the path does not exist or is not accessible
 * @throws {Error} If the path is not a directory
 * @throws {Error} If the directory could not be fully emptied
 */
export async function emptyFolderSafe(path) {

    try {

        await fileExistsAndAccessible_errorOnFail(path);

        if (!await isDirectory(path)) {
            const customError = new Error("Path is not a directory");
            customError.data = {
                path
            };
            throw customError;

        }

        const files = await readdir(path);

        await Promise.all(files.map(file => deleteFileSafe(join(path, file))));

        await fileIsEmpty_errorOnFail(path);

    } catch (error) {
        const customError = new Error("Unable to empty folder", { cause: error });
        customError.data = {
            path
        };
        throw customError;
    }

}

/**
 * @summary Checks if a file exists and is accessible
 * @description This function checks if a file exists and is readable. Throws an error if not
 * @param {String} path File path to check 
 * @returns {Promise<void>} Resolves if the file exists and is accessible, otherwise throws an error
 * @throws {Error} If the file does not exist or is not accessible
 */
async function fileExistsAndAccessible_errorOnFail(path) {

    try {
        await access(path, constants.R_OK);
    } catch {
        const customError = new Error("File does not exist or is not accessible");
        customError.data = {
            path
        };
        throw customError;
    }

}

/**
 * @summary Checks if a file does not exist
 * @description This function checks if a file does not exist. Throws an error if the file exists.
 * @param {String} path The file path to check for existence
 * @returns {Promise<void>} Resolves if the file does not exist, otherwise throws an error
 * @throws {Error} If the file exists 
 */
async function fileDoesNotExist_errorOnFail(path) {

    if (await fileExists(path)) {

        const customError = new Error("File exist");
        customError.data = {
            path
        };
        throw customError;

    }

}

/**
 * @summary Checks whether a file or directory is empty
 * @description For a file, checks that its size is zero. For a directory, checks that it contains no entries. Throws if the path does not exist or is neither a file nor a directory.
 * @param {String} path Absolute or relative path to check
 * @returns {Promise<Boolean>} Resolves to true if the file or directory is empty, false otherwise
 * @throws {Error} If the path does not exist or is not accessible
 * @throws {Error} If the path is neither a file nor a directory
 */
export async function isEmptySafe(path) {

    try {

        await fileExistsAndAccessible_errorOnFail(path);

        // Determine if the path is a file or a directory
        const stats = await stat(path);
        if (stats.isFile()) {
            return stats.size === 0;
        } else if (stats.isDirectory()) {
            const files = await readdir(path);
            return files.length === 0;
        } else {
            throw new Error("Path is neither a file nor a directory");
        }

    } catch (error) {
        const customError = new Error("Unable to check if path is empty", { cause: error });
        customError.data = {
            path
        };
        throw customError;
    }

}

/**
 * @summary Checks whether a path points to a directory
 * @description Verifies the path exists and is accessible, then returns whether it is a directory according to its filesystem stats.
 * @param {String} path Absolute or relative path to check
 * @returns {Promise<Boolean>} Resolves to true if the path is a directory, false otherwise
 * @throws {Error} If the path does not exist, is not accessible, or the stat check fails
 */
export async function isDirectory(path) {

    try {

        await fileExistsAndAccessible_errorOnFail(path);

        const stats = await stat(path);
        return stats.isDirectory();

    } catch (error) {
        const customError = new Error("Unable to check if path is a directory", { cause: error });
        customError.data = {
            path
        };
        throw customError;
    }

}

/**
 * @summary Asserts that a path is a directory
 * @description Checks whether the given path is a directory and throws if it is not. Intended as a guard before directory-specific operations.
 * @param {String} path Absolute or relative path to assert
 * @returns {Promise<void>} Resolves if the path is a directory
 * @throws {Error} If the path is not a directory or the check itself fails
 */
async function isDirectory_errorOnFail(path) {

    try {

        if (!await isDirectory(path)) {
            const customError = new Error("Path is not a directory");
            customError.data = {
                path
            };
            throw customError;
        }

    } catch (error) {
        const customError = new Error("Unable to check if path is a directory", { cause: error });
        customError.data = {
            path
        };
        throw customError;
    }

}

/**
 * @summary Asserts that a file or directory is empty
 * @description Checks whether the given path is empty and throws if it is not. Intended as a post-operation guard to confirm an emptying succeeded.
 * @param {String} path Absolute or relative path to assert
 * @returns {Promise<void>} Resolves if the path is empty
 * @throws {Error} If the path is not empty or the emptiness check fails
 */
async function fileIsEmpty_errorOnFail(path) {

    try {

        if (!await isEmptySafe(path)) {
            const customError = new Error("File is not empty");
            customError.data = {
                path
            };
            throw customError;
        }

    } catch (error) {
        const customError = new Error("Something went wrong while checking if file is empty", { cause: error });
        customError.data = {
            path
        };
        throw customError;
    }

}

//#region Move and copy files

/**
 * @summary Copies a file or directory safely
 * @description Copies a file or directory (recursively) from src to dest while keeping the original in place. Verifies that the destination exists after the operation.
 * @param {String} src Absolute or relative path of the source file or directory
 * @param {String} dest Absolute or relative path of the copy destination
 * @returns {Promise<void>} Resolves when the copy has completed and the destination is verified
 * @throws {Error} If the source does not exist, the copy fails, or the destination is not accessible afterwards
 */
export async function cpSafe(src, dest) {

    try {

        await movePathSafe(src, dest, true);

    } catch (error) {

        const customError = new Error("Unable to copy file", { cause: error });
        customError.data = {
            src,
            dest
        };
        throw customError;

    }

}

/**
 * @summary Moves a file or directory safely
 * @description Moves a file or directory from src to dest by renaming it. Verifies that the destination exists and the source is gone after the operation.
 * @param {String} src Absolute or relative path of the source file or directory
 * @param {String} dest Absolute or relative path of the move destination
 * @returns {Promise<void>} Resolves when the move has completed and the destination is verified
 * @throws {Error} If the source does not exist, the move fails, or the destination is not accessible afterwards
 */
export async function mvSafe(src, dest) {

    try {

        await movePathSafe(src, dest, false);

    } catch (error) {

        const customError = new Error("Unable to move file", { cause: error });
        customError.data = {
            src,
            dest
        };
        throw customError;

    }

}

/**
 * @summary Moves or copies a path to a new destination
 * @description Internal implementation shared by cpSafe and mvSafe. When keepOriginal is true, the source is copied using cp; otherwise it is renamed. Verifies that the destination is accessible after the operation.
 * @param {String} src Absolute or relative path of the source file or directory
 * @param {String} dest Absolute or relative path of the destination
 * @param {Boolean} [keepOriginal=false] When true, copies the source instead of moving it
 * @returns {Promise<void>} Resolves when the operation has completed and the destination is verified
 * @throws {Error} If the source does not exist, the operation fails, or the destination is not accessible afterwards
 */
async function movePathSafe(src, dest, keepOriginal = false) {

    try {

        await fileExistsAndAccessible_errorOnFail(src);

        if (keepOriginal) {

            await cp(src, dest, { recursive: await isDirectory(src) });

        } else {

            await rename(src, dest);

        }

        await fileExistsAndAccessible_errorOnFail(dest);


    } catch (error) {

        const customError = new Error("Unable to move file", { cause: error });
        customError.data = {
            src,
            dest,
            keepOriginal
        };
        throw customError;

    }

}

//#endregion

/**
 * @summary Returns filesystem stats for a path safely
 * @description Verifies the path exists and is accessible, then returns the full Stats object from node:fs/promises stat.
 * @param {String} path Absolute or relative path to stat
 * @returns {Promise<import('node:fs').Stats>} Resolves with the Stats object for the given path
 * @throws {Error} If the path does not exist, is not accessible, or the stat call fails
 */
export async function statSafe(path) {

    try {

        await fileExistsAndAccessible_errorOnFail(path);

        try {
            const stats = await stat(path);
            return stats;
        } catch (error) {
            const customError = new Error("Stat failed", { cause: error });
            customError.data = {
                path
            };
            throw customError;
        }

    } catch (error) {

        const customError = new Error("Unable to stat file", { cause: error });
        customError.data = {
            path
        };
        throw customError;
    }

}

/**
 * @summary Lists the entries of a directory safely
 * @description Verifies that the path exists, is accessible, and is a directory, then returns the list of entry names it contains (non-recursive).
 * @param {String} path Absolute or relative path of the directory to list
 * @returns {Promise<Array<String>>} Resolves with an array of entry names (files and subdirectories) inside the directory
 * @throws {Error} If the path does not exist, is not accessible, is not a directory, or the read fails
 */
export async function listFilesSafe(path) {

    try {

        await fileExistsAndAccessible_errorOnFail(path);

        await isDirectory_errorOnFail(path);

        try {
            const files = await readdir(path);
            return files;
        } catch (error) {
            const customError = new Error("Unable to read directory", { cause: error });
            customError.data = {
                path
            };
            throw customError;
        }

    } catch (error) {

        const customError = new Error("Unable to list files in directory", { cause: error });
        customError.data = {
            path
        };
        throw customError;
    }

}

export default {
    writeFileSafe,
    fileExists,
    mkdirSafe,
    deleteFileSafe,
    emptyFolderSafe,
    isEmptySafe,
    isDirectory,
    cpSafe,
    mvSafe,
    statSafe,
    listFilesSafe
};