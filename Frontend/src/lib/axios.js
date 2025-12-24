import axios from "axios";

const API_BASE = import.meta.env.VITE_BACKEND_URL;

export const axiosInstance = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});


let isSessionExpiredToastShown = false;

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;

    if (status === 401) {
      if (!isSessionExpiredToastShown) {
        isSessionExpiredToastShown = true;

        import("react-hot-toast").then(({ default: toast }) => {
          toast.error("Session expired. Please login again.");
        });
      }

      
    }

    return Promise.reject(error);
  }
);
