declare module 'midtrans-client' {
    interface Snap {
      new (options: {
        isProduction: boolean;
        serverKey: string;
        clientKey?: string;
      }): Snap;
      
      createTransaction(parameter: any): Promise<{
        token: string;
        redirect_url: string;
      }>;
      
      transaction: {
        status(token: string): Promise<any>;
        notification(notification: any): Promise<any>;
      };
    }
  
    interface Core {
      new (options: {
        isProduction: boolean;
        serverKey: string;
        clientKey?: string;
      }): Core;
    }
  
    export interface MidtransClient {
      Snap: Snap;
      Core: Core;
    }
  
    const midtransClient: MidtransClient;
    export default midtransClient;
  }