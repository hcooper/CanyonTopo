#!/usr/bin/env python3
import os
import requests
import logging

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

# Force https in the URL
site_url = os.environ["MEDIAWIKI_SITE_URL"]
if not site_url.startswith("https://"):
    site_url = "https://" + site_url.lstrip("http://").lstrip("https://")
API_URL = site_url.rstrip('/') + '/api.php'

USERNAME = os.environ["MEDIAWIKI_USERNAME"]
PASSWORD = os.environ["MEDIAWIKI_PASSWORD"]
NAMESPACE = 3000  # Replace with actual TOPO_DATA namespace ID

session = requests.Session()

def login():
    print(API_URL)
    logging.info("Fetching login token...")
    r1 = session.get(API_URL, params={
        "action": "query",
        "meta": "tokens",
        "type": "login",
        "format": "json"
    }, timeout=2)
    login_token = r1.json()["query"]["tokens"]["logintoken"]

    logging.info("Logging in as %s...", USERNAME)
    r2 = session.post(API_URL, data={
        "action": "login",
        "lgname": USERNAME,
        "lgpassword": PASSWORD,
        "lgtoken": login_token,
        "format": "json"
    })
    result = r2.json()
    if result["login"]["result"] != "Success":
        raise Exception("Login failed: %s" % result)
    logging.info("Login successful.")

def get_all_pages_in_namespace(namespace):
    logging.info("Fetching all pages in namespace %s...", namespace)
    pages = []
    apcontinue = ""
    while True:
        params = {
            "action": "query",
            "list": "allpages",
            "apnamespace": namespace,
            "aplimit": "max",
            "format": "json"
        }
        if apcontinue:
            params["apcontinue"] = apcontinue

        r = session.get(API_URL, params=params).json()
        batch = [p["title"] for p in r["query"]["allpages"]]
        pages += batch
        logging.info("Fetched %d pages (total: %d)...", len(batch), len(pages))

        if "continue" in r:
            apcontinue = r["continue"]["apcontinue"]
        else:
            break
    logging.info("Total pages fetched: %d", len(pages))
    return pages

def get_page_content(title):
    logging.debug("Fetching content for: %s", title)
    r = session.get(API_URL, params={
        "action": "query",
        "prop": "revisions",
        "titles": title,
        "rvslots": "main",
        "rvprop": "content",
        "formatversion": "2",
        "format": "json"
    }).json()
    try:
        return r["query"]["pages"][0]["revisions"][0]["slots"]["main"]["content"]
    except (KeyError, IndexError):
        logging.warning("Failed to get content for: %s", title)
        return ""

def dump_to_files(pages):
    os.makedirs("topo_dumps", exist_ok=True)
    for title in pages:
        content = get_page_content(title)
        filename = f"topo_dumps/{title.replace('/', '_')}.txt"
        with open(filename, "w", encoding="utf-8") as f:
            f.write(content or "")
        logging.info("Dumped: %s", title)

if __name__ == "__main__":
    login()
    pages = get_all_pages_in_namespace(NAMESPACE)
    dump_to_files(pages)

