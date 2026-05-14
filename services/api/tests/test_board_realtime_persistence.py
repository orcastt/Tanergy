import asyncio

from tangent_api.realtime.board_realtime_persistence import BoardRealtimePersistenceCoordinator


class FakeRealtimeStorage:
    def __init__(self):
        self.writes = []

    def load_document(self, workspace_id: str, board_id: str) -> list[list[int]]:
        _ = (workspace_id, board_id)
        return []

    def write_document(
        self,
        workspace_id: str,
        board_id: str,
        room_key: str,
        document_updates: list[list[int]],
    ) -> None:
        self.writes.append({
            "board_id": board_id,
            "document_updates": [list(update) for update in document_updates],
            "room_key": room_key,
            "workspace_id": workspace_id,
        })


def test_board_realtime_persistence_coalesces_queued_writes():
    async def run_test():
        storage = FakeRealtimeStorage()
        coordinator = BoardRealtimePersistenceCoordinator(storage=storage, debounce_seconds=0.01)

        await coordinator.queue_document("workspace_a", "board_a", "room_a", [[1, 1, 1]])
        await coordinator.queue_document("workspace_a", "board_a", "room_a", [[1, 1, 1], [2, 2, 2]])
        await coordinator.queue_document("workspace_a", "board_a", "room_a", [[1, 1, 1], [2, 2, 2], [3, 3, 3]])
        await asyncio.sleep(0.05)

        assert storage.writes == [{
            "board_id": "board_a",
            "document_updates": [[1, 1, 1], [2, 2, 2], [3, 3, 3]],
            "room_key": "room_a",
            "workspace_id": "workspace_a",
        }]

    asyncio.run(run_test())


def test_board_realtime_persistence_finalize_flushes_and_cancels_pending_write():
    async def run_test():
        storage = FakeRealtimeStorage()
        coordinator = BoardRealtimePersistenceCoordinator(storage=storage, debounce_seconds=0.05)

        await coordinator.queue_document("workspace_b", "board_b", "room_b", [[4, 4, 4]])
        await coordinator.finalize_document("workspace_b", "board_b", "room_b", [[4, 4, 4], [5, 5, 5]])
        await asyncio.sleep(0.1)

        assert storage.writes == [{
            "board_id": "board_b",
            "document_updates": [[4, 4, 4], [5, 5, 5]],
            "room_key": "room_b",
            "workspace_id": "workspace_b",
        }]

    asyncio.run(run_test())


def test_board_realtime_persistence_releases_write_lock_after_debounced_flush():
    async def run_test():
        storage = FakeRealtimeStorage()
        coordinator = BoardRealtimePersistenceCoordinator(storage=storage, debounce_seconds=0.01)

        await coordinator.queue_document("workspace_c", "board_c", "room_c", [[7, 7, 7]])
        await asyncio.sleep(0.05)

        loop_state = coordinator._get_loop_state()
        assert ("workspace_c", "board_c") not in loop_state.pending
        assert ("workspace_c", "board_c") not in loop_state.write_locks

    asyncio.run(run_test())


def test_board_realtime_persistence_releases_write_lock_after_finalize_flush():
    async def run_test():
        storage = FakeRealtimeStorage()
        coordinator = BoardRealtimePersistenceCoordinator(storage=storage, debounce_seconds=0.05)

        await coordinator.queue_document("workspace_d", "board_d", "room_d", [[8, 8, 8]])
        await coordinator.finalize_document("workspace_d", "board_d", "room_d", [[8, 8, 8], [9, 9, 9]])
        await asyncio.sleep(0.1)

        loop_state = coordinator._get_loop_state()
        assert ("workspace_d", "board_d") not in loop_state.pending
        assert ("workspace_d", "board_d") not in loop_state.write_locks

    asyncio.run(run_test())
