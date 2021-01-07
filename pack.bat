@ECHO OFF

pakman --compile --source=.\ --optimize --output=.\.bin\org.santedb.emr.pak --keyFile=..\..\keys\community.santesuite.net.pfx --keyPassword=..\..\keys\community.santesuite.net.pass --embedcert --install --publish --publish-server=https://packages.santesuite.net

