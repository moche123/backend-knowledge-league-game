
# LOGIN 

curl --data "email=carlos@gmail.com&password=12345678" http://localhost:3000/auth/login

# REGISTER 

curl --data "name=Carlos&email=carlos@gmail.com&password=12345678" http://localhost:3000/auth/register

# REFRESH TOKEN (usa el refreshToken devuelto por login/register)

curl --data "refreshToken=PASTE_REFRESH_TOKEN_HERE" http://localhost:3000/auth/refresh

# LOGOUT (requiere el accessToken vigente, invalida el refresh token guardado)

curl -X POST -H "Authorization: Bearer PASTE_ACCESS_TOKEN_HERE" http://localhost:3000/auth/logout
