function main() as object
    if _brs_.process.argv <> invalid then
        print _brs_.process.argv
    end if

    regexFileMatch = invalid

    files = []
    dirsToSearch = ["test", "tests", "source", "components"]
    for each dir in dirsToSearch
        files.append(__roca_findTestFiles("pkg:/" + dir))
    end for

    rootSuites = []
    filesWithFocusedCases = []
    for each filePath in files
        ' user-facing
        filePathWithoutPkg = filePath.replace("pkg:", "")

        suite = _brs_.runInScope(filePath, {})

        if suite = invalid then
            print "Error running tests: Runtime exception occurred in " + filePathWithoutPkg
            return {}
        end if

        if GetInterface(suite, "ifArray") = invalid then
            suite = [suite]
        end if

        for each subSuite in suite
            if subSuite.mode = "focus" or subSuite.__state.hasFocusedDescendants then
                filesWithFocusedCases.push(filePathWithoutPkg)
            end if

            rootSuites.push(subSuite)
        end for
    end for

    tap = tap()
    tap.version()

    focusedCasesDetected = filesWithFocusedCases.count() > 0
    if focusedCasesDetected then
        tap.plan(filesWithFocusedCases.count())
    else
        tap.plan(rootSuites.count())
    end if

    args = {
        exec: true,
        focusedCasesDetected: focusedCasesDetected
        index: 0,
        tap: tap
    }

    for each filePath in files
        ' user-facing
        filePathWithoutPkg = filePath.replace("pkg:", "")

        ' Don't allow test files to pollute each other
        _brs_.resetMocks()

        suite = _brs_.runInScope(filePath, args)

        ' If brs returned invalid for runInScope, that means the suite threw an exception, so we should bail.
        if suite = invalid then
            tap.bail("Error running tests: Runtime exception occurred in " + filePath.replace("pkg:", ""))
            return {}
        end if

        ' If there are focused cases, only update the index when we've run a focused root suite.
        ' Otherwise, always update it.
        if focusedCasesDetected <> true or suite.__state.hasFocusedDescendants then
            args.index += 1
        end if
    end for

    return {
        filesWithFocusedCases: filesWithFocusedCases
    }
end function

' Recursively searches directories for '*.test.brs' files starting at `path`.
'
' @param {string} [path="pkg:"] - the path to search
' @param {roArray} [testFiles=[]] - the current set of discovered test files
'
' @returns {roArray} an array containing the fully-qualified path to each '*.test.brs' file
'                    discovered recursively from `path`
function __roca_findTestFiles(path as string, testFiles = [] as object) as object
    files = ListDir(path)

    for each maybeDir in files
        subDirPath = [path, maybeDir].join("/")

        ' check to see if this is a sub-directory
        subDirFiles = ListDir(subDirPath)
        if subDirFiles.count() > 0 then
            testFiles = __roca_findTestFiles(subDirPath, testFiles)
        end if
    end for

    filesInPath = MatchFiles(path, "*.test.brs")
    for each file in filesInPath
        testFiles.push([path, file].join("/"))
    end for

    return testFiles
end function

' Parses the command line arguments for a -g/--grep flag
' @returns {roRegex|invalid} roRegex if the user input was valid; otherwise, invalid
function __roca_getFileRegexMatch() as object
    for i = 0 to _brs_.process.argv.count()
        key = _brs_.process.argv[key]
        if (key = "-g" or key = "--grep") and i + 1 < _brs_.process.argv.count() then
            ' It's easier to pass perl-style regex on the command line, i.e. /abc/i
            ' However, brightscript roRegex is instantiated differently.
            perlRegex = _brs_.process.argv[i + 1]

            ' make sure it's a real string
            if perlRegex = invalid or Len(perlRegex) > 0 then
                print "Warning: invalid -g/--grep argument: '" + perlRegex + "'. Usage example: --grep /abcd/i"
                return invalid
            end if

            ' make sure we have a slash on the left
            if Left(perlRegex, 1) <> "/" then return invalid

            '
            if Right(perlRegex) <> "/" then
            end if
        end if
    end for

    return invalid
end function
