from io import BytesIO


class FakeS3NotFound(Exception):
    response = {
        "Error": {"Code": "NoSuchKey"},
        "ResponseMetadata": {"HTTPStatusCode": 404},
    }


class FakeS3Client:
    def __init__(self):
        self.objects = {}

    def put_object(self, Body, Bucket, ContentType, Key):
        self.objects[(Bucket, Key)] = {"Body": Body, "ContentType": ContentType}

    def get_object(self, Bucket, Key):
        stored = self.objects.get((Bucket, Key))
        if not stored:
            raise FakeS3NotFound()
        return {"Body": BytesIO(stored["Body"]), "ContentType": stored["ContentType"]}


class FakePostgresCursor:
    def __init__(self, database):
        self.database = database
        self.row = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, query, params=None):
        normalized = " ".join(query.split())
        if normalized.startswith("INSERT INTO tangent_boards"):
            key = (params[1], params[0])
            self.database.boards[key] = (
                params[0],
                params[1],
                params[2],
                params[3],
                params[4],
                params[5],
                params[6],
            )
        elif normalized.startswith("SELECT id, workspace_id, owner_id, title, document"):
            self.row = self.database.boards.get((params[0], params[1]))
        elif normalized.startswith("INSERT INTO tangent_assets"):
            key = (params[1], params[0])
            self.database.assets[key] = params
        elif normalized.startswith("SELECT id, workspace_id, created_by"):
            self.row = self.database.assets.get((params[0], params[1]))

    def fetchone(self):
        return self.row


class FakePostgresConnection:
    def __init__(self, database):
        self.database = database
        self.commits = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def cursor(self):
        return FakePostgresCursor(self.database)

    def commit(self):
        self.commits += 1


class FakePostgresDatabase:
    def __init__(self):
        self.assets = {}
        self.boards = {}

    def connect(self):
        return FakePostgresConnection(self)
