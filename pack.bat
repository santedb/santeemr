@ECHO OFF
IF [%1] == [] (
	echo Must specify version number to build - example: pack.bat 3.0.1000
	goto end
)

SET cwd="%cd%"
ECHO Building Applets
FOR /D %%G IN (.\*) DO (
	PUSHD %%G
	IF EXIST "manifest.xml" (
		pakman --compile --source=.\ --version=%1 --optimize --output=..\bin\org.santeemr.%%~nxG.pak --sign --certHash=8aa3697b3609a5eafdcefa6bc314b38ce800ab41 --embedcert --install
	)
	POPD
)


:end