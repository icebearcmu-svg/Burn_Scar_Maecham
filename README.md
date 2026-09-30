# Mae Chaem Burn Scar and Recovery Platform

## Run the web platform

```powershell
npm.cmd run dev
```

Open the address reported by Vite, usually `http://localhost:5173/scm/`.

## Enable BRR swipe comparison

Open a **second** terminal in this project and run once:

```powershell
npm.cmd run geoserver:init
```

This starts a project-only GeoServer at `localhost:8081`. It uses the project folder
`geoserver-data`, does not change the existing GeoServer on port 8080, and does not
connect to a remote server. The six BRR class GeoTIFFs remain the source data; the
local service only publishes display tiles for the swipe comparison.

After the command reports success, refresh the web page and select **กวาดเปรียบเทียบ 2 ปี**
under **ชั้นการฟื้นตัว**.
