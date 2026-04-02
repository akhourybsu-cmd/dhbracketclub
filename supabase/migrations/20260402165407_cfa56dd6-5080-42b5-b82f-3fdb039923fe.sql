-- Fix draft states: advance current_pick_number to the NEXT pick (not the last made)
UPDATE public.drafts SET current_pick_number=10, current_round=2, current_pick_user_id='a0e950e7-9d34-471f-818a-9ed30ed09b78' WHERE id='0afc46e1-e312-4f0c-9d02-bd03963715ac';

UPDATE public.drafts SET current_pick_number=13, current_round=3, current_pick_user_id='79ebdb7f-0118-452a-9762-196b560d3f3c' WHERE id='5821e43e-d7f8-46f2-86ed-21e78572fec8';

UPDATE public.drafts SET current_pick_number=23, current_round=5, current_pick_user_id='79ebdb7f-0118-452a-9762-196b560d3f3c' WHERE id='d01b172b-581c-496e-bfc0-8f9e36d03525';

UPDATE public.drafts SET current_pick_number=23, current_round=5, current_pick_user_id='79ebdb7f-0118-452a-9762-196b560d3f3c' WHERE id='211b514d-f398-4d74-906b-8996f7df8e7a';