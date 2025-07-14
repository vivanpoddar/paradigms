import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error) {
      // Get the user information after successful verification
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        try {
          console.log('Attempting to call create-user-folder edge function for user:', user.id);
          
          // Get the session to include the authorization header
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session) {
            console.error('No session found after verification');
            redirect(`/auth/error?error=Authentication session not found`);
          }
          
          // Call the create-user-folder edge function with proper authorization
          const { data, error: edgeError } = await supabase.functions.invoke('create-user-folder', {
            body: { userId: user.id },
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
          
          console.log('Edge function response:', { data, error: edgeError });
          
          if (edgeError) {
            console.error('Error creating user folder:', edgeError);
            redirect(`/auth/error?error=Failed to create user folder: ${edgeError.message}`);
          }
          
          console.log('User folder created successfully');
        } catch (error) {
          console.error('Error calling create-user-folder edge function:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
          redirect(`/auth/error?error=Failed to create user folder: ${errorMessage}`);
        }
      }
      
      // redirect user to specified redirect URL or root of app
      redirect(next);
    } else {
      // redirect the user to an error page with some instructions
      redirect(`/auth/error?error=${error?.message}`);
    }
  }

  // redirect the user to an error page with some instructions
  redirect(`/auth/error?error=No token hash or type`);
}
