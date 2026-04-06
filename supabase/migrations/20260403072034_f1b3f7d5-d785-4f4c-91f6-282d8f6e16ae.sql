-- Function to auto-accept pending invitations when a user profile is created
CREATE OR REPLACE FUNCTION public.accept_pending_invitations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv RECORD;
  user_email text;
BEGIN
  -- Get user email from auth.users
  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;
  
  IF user_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find all pending invitations for this email
  FOR inv IN
    SELECT id, org_id, role FROM public.invitations
    WHERE email = user_email AND status = 'pending'
  LOOP
    -- Add user to organization
    INSERT INTO public.organization_members (org_id, user_id, role)
    VALUES (inv.org_id, NEW.id, inv.role)
    ON CONFLICT DO NOTHING;

    -- Update invitation status
    UPDATE public.invitations SET status = 'accepted' WHERE id = inv.id;

    -- Set first org as current if not set
    IF NEW.current_org_id IS NULL THEN
      UPDATE public.profiles SET current_org_id = inv.org_id WHERE id = NEW.id;
      NEW.current_org_id := inv.org_id;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger after profile insert (which happens via handle_new_user on auth signup)
CREATE TRIGGER on_profile_created_accept_invitations
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.accept_pending_invitations();