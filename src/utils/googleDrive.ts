import { getAccessToken } from "../lib/firebase";

export interface GoogleDriveUploadResult {
  success: boolean;
  id?: string;
  webViewLink?: string;
  error?: string;
}

/**
 * Uploads a file (Blob) directly to Google Drive.
 * First creates the file metadata, then uploads the file content, and finally retrieves the shareable web link.
 */
export async function uploadFileToGoogleDrive(
  filename: string,
  mimeType: string,
  blob: Blob
): Promise<GoogleDriveUploadResult> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return { 
        success: false, 
        error: "Autenticação ausente ou expirada. Conecte-se com sua Conta Google para habilitar o Google Drive." 
      };
    }

    // Etapa 1: Criar o registro de metadados do arquivo (Nome e MimeType)
    const metadataResponse = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: filename,
        mimeType: mimeType,
      }),
    });

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error("Erro Drive (metadados):", errorText);
      return { 
        success: false, 
        error: `Não foi possível iniciar o arquivo no Google Drive (${metadataResponse.status} ${metadataResponse.statusText})` 
      };
    }

    const fileMetadata = await metadataResponse.json();
    const fileId = fileMetadata.id;

    if (!fileId) {
      return { 
        success: false, 
        error: "Google Drive não retornou um ID de arquivo válido." 
      };
    }

    // Etapa 2: Fazer upload dos dados binários (Blob) por PATCH
    const mediaResponse = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": mimeType,
      },
      body: blob,
    });

    if (!mediaResponse.ok) {
      const errorText = await mediaResponse.text();
      console.error("Erro Drive (upload):", errorText);
      return { 
        success: false, 
        error: `Falha ao transferir o conteúdo para o Google Drive (${mediaResponse.status} ${mediaResponse.statusText})` 
      };
    }

    // Etapa 3: Buscar link de visualização web do arquivo
    const getFileResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=webViewLink`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    let webViewLink: string | undefined;
    if (getFileResponse.ok) {
      const fileData = await getFileResponse.json();
      webViewLink = fileData.webViewLink;
    }

    return {
      success: true,
      id: fileId,
      webViewLink,
    };
  } catch (err: any) {
    console.error("Erro ao salvar no Google Drive:", err);
    return { 
      success: false, 
      error: err.message || "Erro inesperado ao conectar com o Google Drive." 
    };
  }
}
