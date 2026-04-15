def whcms_license_info(md5hash, datahash, results):
    if md5hash == datahash:
        try:
            return md5hash
        except:
            return results
        return
