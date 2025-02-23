"use client";
import React, { useContext, useEffect, useState } from "react";
import { Upload } from "./Upload";
import { UseReadContractData } from "@/utils/fetchcontract";
import { WalletContext } from "@/components/walletprovider";
import NoRecordScreen from "./NoRecordScreen";

const Uploads = () => {
  const { address } = useContext(WalletContext);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [fileData, setFileData] = useState([]);
  const NFT_STORAGE_TOKEN = process.env.NEXT_PUBLIC_IPFS_KEY;

  useEffect(() => {
    const retrieve = async () => {
      try {
        const { fetchData } = UseReadContractData();
        const result = await fetchData("crime", "get_all_user_uploads", [address]);
  
        const files = result && typeof result === 'object' 
          ? Object.keys(result).map((key) => ({
              id: result[key].toString(),
              timestamp: Date.now() // Placeholder timestamp
            }))
          : [];
  
        setUploadedFiles(files);
      } catch (error) {
        console.error("Error fetching uploaded files:", error);
      }
    };
  
    if (address) retrieve();
  }, [address]);
  
  useEffect(() => {
    const userUploads = async () => {
      try {
        // Step 1: Fetch URIs from the blockchain for each file
        const blockchainUris = await Promise.all(
          uploadedFiles.map(async (file) => {
            const { fetchData } = UseReadContractData();
            const uploadUri = await fetchData("crime", "get_token_uri", [file.id]);
            return uploadUri;
          })
        );
  
        // Step 2: Fetch metadata from Pinata
        const response = await fetch(`https://api.pinata.cloud/data/pinList`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${NFT_STORAGE_TOKEN}` },
        });
  
        if (!response.ok) throw new Error("Error fetching metadata from Pinata");
  
        const metadata = await response.json();
        const pinataFiles = metadata.rows;  // Use `rows` as per the structure in your data
        console.log(pinataFiles);
  
        // Step 3: Find matches between blockchain URIs and Pinata CIDs
        const matchedFiles = blockchainUris.map((uri) => {
          const matchedFile = pinataFiles.find((file) => file.ipfs_pin_hash === uri);
          if (matchedFile) {
            console.log("Match found:", matchedFile);
            return {
              uri,
              filename: matchedFile.metadata.name || "Unknown Filename",
              timestamp: new Date(matchedFile.date_pinned).getTime(),  // Use actual timestamp
            };
          }
          return null;
        }).filter(Boolean); // Filter out unmatched items
  
        setFileData(matchedFiles);
      } catch (error) {
        console.error("Error retrieving URIs or metadata:", error);
      }
    };
  
    if (uploadedFiles.length) userUploads();
  }, [uploadedFiles]);
  
  
  const isImageFile = (fileName) => /\.(jpg|jpeg|png|gif|bmp)$/i.test(fileName);
  const isVideoFile = (fileName) => /\.(mp4|webm|ogg|mov)$/i.test(fileName);

  const saveToDevice = (blob, fileName) => {
    const uniqueFileName = `${fileName}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = uniqueFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });   
  };

  const handleDownload = async (file) => {
    try {
      const response = await fetch(`https://gateway.pinata.cloud/ipfs/${file.uri}`);
      const blob = await response.blob();
      saveToDevice(blob, file.filename);
    } catch (error) {
      console.error("Error downloading the file:", error);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="p-2">
        {!fileData.length ? (
          <NoRecordScreen />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-white">
            {fileData.map((file, index) => (
              <div key={index} className="relative text-sm whitespace-nowrap mb-2 sm:mb-0 bg-transparent rounded-lg backdrop-blur-lg p-10 shadow-lg">
                
                {isImageFile(file.filename) ? (
                  <img
                    src={`https://gateway.pinata.cloud/ipfs/${file.uri}`}
                    alt={file.filename}
                    className="w-full h-auto rounded"
                  />
                ) : isVideoFile(file.filename) ? (
                  <video
                    src={`https://gateway.pinata.cloud/ipfs/${file.uri}`}
                    className="w-full h-auto rounded"
                  />
                ) : (
                  <p className="text-red-500">Unsupported file type</p>
                )}

                <p className="w-full px-2 py-2 text-[#0094FF] rounded-[2em] border-slate-800 shadow-lg 
                  transform hover:scale-105 transition-transform duration-300 border-gradient2 bg-opacity-50 
                  backdrop-filter backdrop-blur-lg flex items-center text-left relative text-[0.8em] 
                  overflow-hidden text-ellipsis whitespace-nowrap max-w-full mt-4"
                  style={{ maxWidth: '250px' }}>
                  {file.filename}
                </p>

                <p className="text-sm flex mt-4">
                  <span className="text-[#EAFBFF]">Time Stamp: </span>
                  <span className="text-[#19B1D2] ml-1">{formatDate(file.timestamp)}</span>
                </p>

                <button
                  onClick={() => handleDownload(file)}
                  className="inline-block mt-5 bg-[#0094FF] text-white py-2 px-4 rounded-[2em] mb-5"
                >
                  {isVideoFile(file.filename) ? "Download Video" : "Download Image"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Uploads;
