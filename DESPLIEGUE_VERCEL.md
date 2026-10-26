# Publicar el catálogo HERCAS en Vercel

El proyecto está en `D:\Aliados exteriores\catalogo_hercas_app`, rama `main`, repositorio `https://github.com/Hercaspublicidad/dispo_hercas.git`. Los datos ya se cargan en Supabase; **no** se sube la carpeta de fotos a GitHub ni a Vercel.

1. Abre PowerShell en `D:\Aliados exteriores\catalogo_hercas_app` y comprueba `node --test tests/*.test.mjs` y `npm run build`.
2. En tu proyecto de Vercel, entra a **Settings → Environment Variables**. Conserva las variables públicas de Supabase que ya configuraste. Añade **`SUPABASE_SECRET_KEY`** como variable de servidor para Production y Preview, con el valor `sb_secret_...` que guardaste en `.env.upload.local`. En **Settings → General**, usa Node.js **22.x o 24.x**. No uses el prefijo `NEXT_PUBLIC_` para esta clave. No subas ningún archivo `.env` a GitHub.
3. Publica los cambios del código desde esta carpeta:

   ```powershell
   git status --short
   git add -A
   git commit -m "Catálogo HERCAS en Supabase y propuestas masivas"
   git push origin main
   ```

   Si Vercel está conectado a `Hercaspublicidad/dispo_hercas`, el push inicia el despliegue. Si no aparece uno nuevo, usa **Deployments → Redeploy** en ese proyecto después de sincronizar la rama.

4. Abre el URL de producción e inicia sesión con una cuenta que tenga `cotizador.availability.read` o `cotizador.availability.manage`. La base tiene 549 registros; la pantalla presenta 508 vallas porque oculta 41 duplicados confirmados. De las visibles, 468 tienen foto y ficha HERCAS. Descarga una ficha individual y una propuesta de dos ciudades. Si gestionas disponibilidad, prueba un catálogo semanal y revisa las coincidencias antes de aplicar.

La variable secreta solo se utiliza en el servidor para guardar los PowerPoint compuestos en el bucket privado. Las imágenes y fichas se sirven con enlaces temporales después de validar la sesión. Las disponibilidades se guardan como eventos históricos y vencen a los ocho días.
